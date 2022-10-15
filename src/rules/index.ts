/* eslint-disable no-undef */

import {
  ComponentBucket,
  FigmaStyleType,
  FigmaTeamComponent,
  FigmaTeamStyle,
  HexStyleMap,
  PropertyCheck,
  StyleBucket,
  StyleLookupMap,
} from "../models/figma";

import { LintCheck } from "../models/stats";
import jp from "jsonpath";
import checkFillStyleMatch from "./fillStyle";
import checkStrokeStyleMatch from "./strokeStyle";
import checkTextMatch from "./textStyle";
import figmaRGBToHex from "../utils/rgbToHex";

/**
 * styleLookupMap - required for partial matches
 */
export type LintCheckOptions = {
  hexStyleMap?: HexStyleMap;
  styleLookupMap?: StyleLookupMap;
};
/**
 * Run through all partial matches, and make exceptions depending on rules
 */
export const runSimilarityChecks = (
  styleBucket: StyleBucket,
  targetNode: BaseNode,
  opts?: LintCheckOptions
): LintCheck[] => {
  const checks: ((
    styleBucket: StyleBucket,
    targetNode: BaseNode,
    opts?: LintCheckOptions
  ) => LintCheck)[] = [
    checkTextMatch,
    checkStrokeStyleMatch,
    checkFillStyleMatch,
  ];

  const results = [];
  for (const check of checks) {
    const lintCheck = check(styleBucket, targetNode, opts);
    results.push(lintCheck);
  }

  return results;
};

/**
 * Check if a Node Type overlaps
 * @param types
 * @param node
 * @returns
 */
export function isNodeOfTypeAndVisible(types: string[], node: BaseNode) {
  return types.includes(node.type);
}

/**
 *
 * @param styles
 * @returns Object with style type and key as indexer
 * @description Creates a map of styles by name
 */
export function generateStyleBucket(
  styles: FigmaTeamStyle[],
  opts?: { includeNames: boolean }
): StyleBucket {
  // create hashmap of styles by styleType
  const styleBuckets: StyleBucket = {};

  for (const style of styles) {
    if (!styleBuckets[style.style_type]) {
      styleBuckets[style.style_type] = {};
    }

    styleBuckets[style.style_type][style.key] = style;

    if (opts?.includeNames) {
      // use the style name as the key
      // serializing this may create duplicate, in memory, they should ref. the same object
      styleBuckets[style.style_type][style.name] = style;
    }
  }

  return styleBuckets;
}

export function getStyleLookupDefinitions(styleType: FigmaStyleType) {
  const FillLookupKeys: PropertyCheck[] = [
    {
      stylePath: "$.fills[0].color.r",
      nodePath: "$.fills[0].color.r",
      matchType: "exact",
    },
    {
      stylePath: "$.fills[0].color.g",
      nodePath: "$.fills[0].color.g",
      matchType: "exact",
    },
    {
      stylePath: "$.fills[0].color.b",
      nodePath: "$.fills[0].color.b",
      matchType: "exact",
    },
    {
      stylePath: "$.fills[0].color.a",
      nodePath: "$.fills[0].opacity",
      matchType: "exact",
    },
  ];

  const TextLookupKeys: PropertyCheck[] = [
    {
      stylePath: "$.style.fontFamily",
      nodePath: "$.style.fontFamily",
      figmaPath: "$.fontName.family",
      matchType: "exact",
      removeSpaces: true,
    },
    {
      stylePath: "$.style.fontSize",
      nodePath: "$.style.fontSize",
      figmaPath: "$.fontSize",
      matchType: "exact",
    },
    {
      stylePath: "$.style.fontPostScriptName",
      nodePath: "$.style.fontPostScriptName",
      figmaPath: "$.fontName.style",
      matchType: "includes",
    },
  ];

  if (styleType === "FILL") return FillLookupKeys;

  if (styleType === "TEXT") return TextLookupKeys;

  return undefined;
}

export function getStyleLookupKey(
  checks: PropertyCheck[],
  node: any,
  nodeType: "styleNode" | "figmaNode"
) {
  const key = [];

  for (const check of checks) {
    if (check.matchType === "exact") {
      let path = check.stylePath;

      // if we're looking at a figma path
      if (nodeType === "figmaNode") {
        path =
          typeof figma === "undefined"
            ? check.nodePath
            : check.figmaPath || check.nodePath;
      }

      let styleValue = jp.value(node, path);

      if (styleValue !== undefined) {
        // an option to clean
        if (check.removeSpaces) {
          styleValue = styleValue.split(" ").join("");
        }
        key.push(styleValue);
      } else {
        if (nodeType === "styleNode") {
          // console.log(`Partial matches not supported for: ${node.name} }`);
        }
      }
    }
  }

  if (key.length == 0) return "";
  return key.join("<->");
}

export function generateStyleLookup(styleBucket: StyleBucket) {
  const styleLookupMap: StyleLookupMap = {};

  const addStyleToValueMap = (
    type: FigmaStyleType,
    styleValue: string,
    style: FigmaTeamStyle
  ) => {
    if (!styleLookupMap[type]) {
      styleLookupMap[type] = {};
    }

    if (!styleLookupMap[type][styleValue]) {
      styleLookupMap[type][styleValue] = [];
    }

    styleLookupMap[type][styleValue].push(style);
  };

  for (const type of Object.keys(styleBucket)) {
    const checks = getStyleLookupDefinitions(type as FigmaStyleType);

    for (const styleKey of Object.keys(styleBucket[type])) {
      const style = styleBucket[type][styleKey];

      if (checks) {
        // dynamic key from the definition
        const key = getStyleLookupKey(checks, style.nodeDetails, "styleNode");

        if (key) {
          addStyleToValueMap(type as FigmaStyleType, key, style);
        }
      }
    }
    /*switch (type) {
        case "TEXT":
          {
            // use the font name
            const styleValue = jp.value(
              style.nodeDetails,
              "$.style.fontFamily"
            );
            if (styleValue) {
              addStyleToValueMap(type, styleValue, style);
            }
          }
          break;
        case "FILL":
          {
            // use the fill hex code - no alpha channel

            const styleValue = jp.value(style.nodeDetails, "$.fills[0].color");
            if (styleValue) {
              // color is a {r, g,b} obj
              const hex = figmaRGBToHex(
                styleValue.r,
                styleValue.g,
                styleValue.b
              );
              addStyleToValueMap(type, hex, style);
            }
          }
          break;
      }*/
  }

  return styleLookupMap;
}

/**
 *
 * @param styles
 * @returns Object with style name as key and style as value
 * @description Creates a map of styles by name
 */
export function generateComponentMap(
  components: FigmaTeamComponent[]
): ComponentBucket {
  // create hashmap of styles by styleType
  const componentBucket: ComponentBucket = {};

  // create a map of the team components by their key
  for (const comp of components) {
    const getComponentReadableName = () => {
      if (comp.name.includes("=")) {
        return comp.containing_frame.name;
      }

      return comp.name;
    };

    if (componentBucket)
      componentBucket[comp.key] = { name: getComponentReadableName() };
  }
  return componentBucket;
}
