const acorn = require("acorn");
const acornJSX = require("acorn-jsx");
const express = require("express");
const acornWalk = require("acorn-walk");
// const fs = require("fs-extra");
const fs = require("fs").promises; 

const router = express.Router();
const JSXParser = acorn.Parser.extend(acornJSX());

// detection of long method
router.post("/detect-long-method", async (request, response) => {
  const { filePath } = request.body;
  if (!filePath) {
    return response.status(400).send("File path is required.");
  }

  try {
    const code = await fs.readFile(filePath, "utf8");
    const comments = [];
    const parsed = JSXParser.parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      onComment: comments, 
      locations: true 
    });

    let feedbackDetails = "";
    const THRESHOLD = 15; 
    let shortestMethod = { name: "", lineCount: Infinity };
    const isLineInComment = (lineNumber) => comments.some(comment => comment.loc.start.line <= lineNumber && comment.loc.end.line >= lineNumber);
    const getExecutableLineCount = (startLine, endLine) => {
      const lines = code.split("\n").slice(startLine - 1, endLine);
      return lines.filter((line, index) => {
        const lineNumber = startLine + index;
        return !isLineInComment(lineNumber) && line.trim().length;
      }).length;
    };

    
    acornWalk.simple(parsed, {
      Function(node) {
        const startLine = node.loc.start.line;
        const endLine = node.loc.end.line;
        const executableLines = getExecutableLineCount(startLine, endLine);
        const functionName = node.id ? node.id.name : "anonymous function";
        if (executableLines < shortestMethod.lineCount) {
          shortestMethod = { name: functionName, lineCount: executableLines };
        }
        if (executableLines > THRESHOLD) {
          feedbackDetails += `Lets gooooooo!\nWe have detected a long method.\nYour function ${functionName} seems to be long.\nExecutable Lines: ${executableLines}, Start: ${startLine}, End: ${endLine}.`;
        }
      },
    });
    if (!feedbackDetails) {
      feedbackDetails = `Damn looks like your code is clean. Good going !\nNo long methods detected.`;
    }
    response.send(feedbackDetails);
  } catch (error) {
    console.error(error);
    response.status(500).send("Error processing the file.");
  }
});
// router.post("/detect-long-method", async (request, response) => {
//   const { filePath } = request.body;
//   if (!filePath) {
//     return response.status(400).send("File path is required.");
//   }

//   try {
//     const code = await fs.readFile(filePath, "utf8");
//     const parsed = JSXParser.parse(code, {
//       ecmaVersion: "latest",
//       sourceType: "module",
//     });
//     let longMethodsDetails = "";
//     const THRESHOLD = 15;

//     const calculateLineNumber = (charPosition) => {
//       return code.substring(0, charPosition).split("\n").length;
//     };

//     const calculateLines = (node) => {
//       const lines = code.substring(node.start, node.end).split("\n").length;
//       return lines;
//     };

//     const getFunctionName = (node) => {
//       if (node.id && node.id.name) {
//         return node.id.name;
//       } else if (
//         node.type === "ArrowFunctionExpression" ||
//         node.type === "FunctionExpression" ||
//         node.type === "FunctionDeclaration"
//       ) {
//         return "anonymous function";
//       }
//       return "unnamed";
//     };

//     acornWalk.simple(parsed, {
//       Function(node) {
//         const lines = calculateLines(node);
//         if (lines > THRESHOLD) {
//           const startLine = calculateLineNumber(node.start);
//           const endLine = calculateLineNumber(node.end);
//           longMethodsDetails += `Lets gooooooo!\nWe have detectd a long method detected.\nCheckout ${getFunctionName(
//             node
//           )}. Ahh thats too long.\n${getFunctionName(node)} starts at line ${startLine} and ends at line ${endLine}.\nThe total lines are ${lines}.\nSo as your Code Doctor I would suggest you to refactor it.\n`;
//         }
//       },
//     });

//     if (longMethodsDetails === "") {
//       response.send("Damn looks like your code is clean. Good going !\nNo long methods detected.");
//     } else {
//       response.send(longMethodsDetails.trim());
//     }
//   } catch (error) {
//     console.error(error);
//     response.status(500).send("Error processing the file.");
//   }
// });

// detect of crowded parameter list
router.post("/detect-long-parameter-list", async (req, res) => {
  const { filePath } = req.body;
  if (!filePath) {
    return res.status(400).send("File path is required.");
  }

  try {
    const code = await fs.readFile(filePath, "utf8");
    const parsed = JSXParser.parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
    });
    const PARAM_THRESHOLD = 3;
    let longParameterListDetails = "";

    const getFunctionName = (node) => {
      if (node.id && node.id.name) {
        return node.id.name;
      } else if (
        node.type === "ArrowFunctionExpression" ||
        node.type === "FunctionExpression" ||
        node.type === "FunctionDeclaration"
      ) {
        return "anonymous function";
      }
      return "unnamed";
    };

    acornWalk.simple(parsed, {
      Function(node) {
        const paramCount = node.params.length;
        if (paramCount > PARAM_THRESHOLD) {
          const startLine = code.substring(0, node.start).split("\n").length;
          const endLine = code.substring(0, node.end).split("\n").length;
          longParameterListDetails += ` ${getFunctionName(node)} Method/ Function with long parameter list detected.\nThe method starts at line ${startLine} and ends at line ${endLine}.\nTotal parameters: ${paramCount}.\n\n`;
        }
      },
    });

    if (longParameterListDetails === "") {
      res.send("Damn looks like your code is clean. Good going !\nNo long parameter list detected.");
    } else {
      res.send(longParameterListDetails.trim());
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error processing the file.");
  }
});

// detect of duplicate code
const jaccardSimilarity = (setA, setB) => {
  setA = new Set(setA);
  setB = new Set(setB);
  const intersection = new Set([...setA].filter((item) => setB.has(item)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
};

function refactorDuplicatedCode(codeFragment1, codeFragment2) {
  const lines1 = codeFragment1.split("\n").map((line) => line.trim());
  const lines2 = codeFragment2.split("\n").map((line) => line.trim());
  const commonLines = lines1.filter((line) => lines2.includes(line));
  if (commonLines.length === 0) {
    return {
      refactored: false,
      codeFragment1,
      codeFragment2,
      refactoredFunction: "",
    };
  }
  const functionName = "refactoredCommonFunction";
  const refactoredFunction = `function ${functionName}() {${commonLines.join(
    "\n  "
  )}}\n`;
  const replaceCommonLines = (lines) => {
    let replaced = [];
    let commonFound = false;
    lines.forEach((line) => {
      if (commonLines.includes(line.trim())) {
        if (!commonFound) {
          replaced.push(`${functionName}();`);
          commonFound = true;
        }
      } else {
        replaced.push(line);
        commonFound = false;
      }
    });
    return replaced.join("\n");
  };
  const newCodeFragment1 = replaceCommonLines(lines1);
  const newCodeFragment2 = replaceCommonLines(lines2);
  return {
    refactored: true,
    codeFragment1: newCodeFragment1,
    codeFragment2: newCodeFragment2,
    refactoredFunction,
  };
}

router.post("/detect-duplicate-code", async (request, response) => {
  const { filePath } = request.body;
  if (!filePath) {
    return response.status(400).send("File path is required.");
  }

  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    const codeFragments = fileContent
      .split("\n\n")
      .map((block) => block.trim());
    let duplicated = false;
    let result = null;
    let responseMessage = "";

    if (codeFragments.length >= 2) {
      const similarity = jaccardSimilarity(
        new Set(codeFragments[0]),
        new Set(codeFragments[1])
      );
      if (similarity > 0.75) {
        duplicated = true;
        result = refactorDuplicatedCode(codeFragments[0], codeFragments[1]);
        responseMessage += "Duplicated code detected.\n";
        responseMessage += `Duplicate code part1 is:\n${codeFragments[0]}\n`;
        responseMessage += `Duplicate code part2 is:\n${codeFragments[1]}\n`;
        responseMessage += "Here is the refactored solution for you:\n";
        responseMessage += result.refactoredFunction; // Assuming refactorDuplicatedCode returns an object with refactoredFunction
      } else {
        responseMessage = "No significant duplicates found.";
      }
    } else {
      responseMessage = "Not enough code fragments for comparison.";
    }

    response.type("text/plain");
    response.send(responseMessage);
  } catch (error) {
    console.error("Error reading file:", error);
    response.status(500).send("Error processing the file.");
  }
});

module.exports = router;


// TO DO
// add the line number while reading the file
// 1. python and js files should be supported
  //// router.post("/detect-long-method", async (request, response) => {
//   const { filePath } = request.body;
//   if (!filePath) {
//     return response.status(400).send("File path is required.");
//   }
//   try {
//     const code = await fs.readFile(filePath, "utf8");
//     let longMethodsDetails = "";
//     const THRESHOLD = 15;

//     // Determine file type (Python or JavaScript) based on file extension
//     const fileType = filePath.split('.').pop();

//     if (fileType === 'js' || fileType === 'jsx') {
//       // Parse JavaScript file
//       const parsed = acorn.parse(code, {
//         ecmaVersion: "latest",
//         sourceType: "module",
//       });

//       acornWalk.simple(parsed, {
//         Function(node) {
//           const lines = calculateLines(code, node);
//           if (lines > THRESHOLD) {
//             const startLine = calculateLineNumber(code, node.start);
//             const endLine = calculateLineNumber(code, node.end);
//             longMethodsDetails += output(getFunctionName(node), startLine, endLine, lines);
//           }
//         },
//       });
//     } else if (fileType === 'py') {
//       // Rudimentary Python function detection
//       longMethodsDetails += detectLongMethodsPython(code, THRESHOLD);
//     } else {
//       return response.status(400).send("Unsupported file type.");
//     }

//     if (longMethodsDetails === "") {
//       response.send("No long methods detected. Your code looks clean. Good going!");
//     } else {
//       response.send(longMethodsDetails.trim());
//     }
//   } catch (error) {
//     console.error(error);
//     response.status(500).send("Error processing the file.");
//   }
// });

// function calculateLineNumber(code, charPosition) {
//   return code.substring(0, charPosition).split("\n").length;
// }

// function calculateLines(code, node) {
//   return code.substring(node.start, node.end).split("\n").length;
// }

// function getFunctionName(node) {
//   if (node.id && node.id.name) {
//     return node.id.name;
//   } else if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression" || node.type === "FunctionDeclaration") {
//     return "anonymous function";
//   }
//   return "unnamed";
// }

// function output(name, startLine, endLine, lines) {
//   return `Lets gooooooo!\nWe have detected a long method.\nCheckout ${name}. Ahh, that's too long.\n${name} starts at line ${startLine} and ends at line ${endLine}.\nThe total lines are ${lines}.\nSo as your Code Doctor, I would suggest you refactor it.\n`;
// }


// function detectLongMethodsPython(code, threshold) {
//   const functionRegex = /def\s+([\w_]+)\s*\((.*?)\)\s*:/g;
//   let match;
//   let longMethodsDetails = "";
  
//   while ((match = functionRegex.exec(code)) !== null) {
//     // This is a very naive way to estimate the function length
//     const startLine = calculateLineNumber(code, match.index);
//     // Look for the next def or the end of the file as an approximation
//     const endMatch = code.substring(match.index + match[0].length).match(/def\s+[\w_]+\s*\(/);
//     const endLine = endMatch ? startLine + calculateLineNumber(code.substring(match.index + match[0].length), endMatch.index) - 1 : calculateLineNumber(code, code.length);
//     const lines = endLine - startLine + 1;
//     if (lines > threshold) {
//       longMethodsDetails += output(match[1], startLine, endLine, lines);
//     }
//   }

//   return longMethodsDetails;
// }
