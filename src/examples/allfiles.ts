import fs from "fs";
import { FigmaCalculator } from "../index";

import { ProcessedPage } from "../models/stats";
import { FIGMA_TOKEN } from "./token";

const figmaCalculator = new FigmaCalculator();

const STYLE_TEAM_ID = "626524232805730321";
const TEAM_IDS = [
  "1040347261379002788",
  "969820474577737549",
  "888190986662740847",
  "758073086094656143",
  "626524232805730321",
  "784245363616834937",
  "763841153159625143",
  "763841187386191288",
  "763841216024165817",
  "708383139233476090",
  "851831158188134404",
];

// used to fetch styles and components
figmaCalculator.setAPIToken(FIGMA_TOKEN);

const doWork = async () => {
  // optional: if not in figma plugin environment, load a file with this
  const { files } = await figmaCalculator.getFilesForTeams(TEAM_IDS, 2, false);

  // load up any style libraries
  const comps = await figmaCalculator.loadComponents(STYLE_TEAM_ID);
  const styles = await figmaCalculator.loadStyles(STYLE_TEAM_ID);

  const compsj = JSON.stringify(comps, null, 2);
  const stylesj = JSON.stringify(styles, null, 2);
  fs.writeFileSync("../comps.json", compsj);
  fs.writeFileSync("../styles.json", stylesj);

  const allPages: ProcessedPage[] = [];

  console.log("Total File Count:", files.length);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    try {
      await figmaCalculator.fetchCloudDocument(file.key);
    } catch (ex) {
      console.log(`Failed to fetch ${file.key}`);
      continue;
    }

    console.log(`Processing file of ${i + 1} of ${files.length}`);

    // run through all of the pages and process them
    for (const page of figmaCalculator.getAllPages()) {
      const processedNodes = figmaCalculator.processTree(page, {
        onProcessNode: (node) => {
          for (const check of node.lintChecks) {
            // example: show the text linting results and suggestions
            if (check.checkName === "Text-Style" && check.matchLevel === "Partial") {
              // console.log(check.suggestions);
            }
          }
        },
      });

      const pageDetails: ProcessedPage = {
        file,
        pageAggregates: processedNodes.aggregateCounts,
        pageName: page.name,
      };
      allPages.push(pageDetails);
    }
  }

  // write all pages to disk in case something goes wrong, so we don't have to reload everything again
  const json = JSON.stringify(allPages, null, 2);
  // console.log(json);
  fs.writeFileSync("./figma-all-pages.json", json);

  const teamBreakdown = figmaCalculator.getBreakDownByTeams(allPages);
  // console.log(JSON.stringify(teamBreakdown));
  fs.writeFileSync("./figma-team-breakdown.json", JSON.stringify(teamBreakdown, null, 2));

  const load1 = await figmaCalculator.loadComponents(STYLE_TEAM_ID);
  // console.log("Loaded Components",load1);
  fs.writeFileSync("./figma-components.json", JSON.stringify(load1, null, 2));

  const load2 = await figmaCalculator.loadStyles(STYLE_TEAM_ID);
  // console.log("Loaded Styles",load2);
  fs.writeFileSync("./figma-styles.json", JSON.stringify(load2, null, 2));

  const load3 = await figmaCalculator.loadLocalVariables(STYLE_TEAM_ID);
  // console.log("Loaded Local Variables",load3);
  fs.writeFileSync("./figma-local-variables.json", JSON.stringify(load3, null, 2));

  const load4 = await figmaCalculator.loadPublishedVariables(STYLE_TEAM_ID);
  // console.log("Loaded Published Variables",load4);
  fs.writeFileSync("./figma-published-variables.json", JSON.stringify(load4, null, 2));
};

doWork();
