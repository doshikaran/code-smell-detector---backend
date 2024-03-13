const acorn = require("acorn");
const acornJSX = require("acorn-jsx");
const express = require("express");
const acornWalk = require("acorn-walk");
const esprima = require('esprima');
const fs = require("fs").promises; 
const estraverse = require("estraverse");
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

// detect duplicate code
const jaccardSimilarity = (setA, setB) => {
  setA = new Set(setA);
  setB = new Set(setB);
  const intersection = new Set([...setA].filter((item) => setB.has(item)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
};
const normalizeCode = (code) => {
  code = code.replace(/\/\/.*$/gm, '');
  code = code.replace(/\/\*[\s\S]*?\*\//gm, '');
  code = code.split('\n').map(line => line.trim()).join('\n');
  code = code.replace(/\s+/g, ' ');
  return code;
};

const generateAST = (code) => {
  try {
    const ast = esprima.parseScript(code);
    return ast;
  } catch (e) {
    console.error('Error generating AST:', e);
    throw e;
  }
};

const areNodesStructurallySimilar = (node1, node2) => {
  if (!node1 && !node2) return true;
  if (!node1 || !node2 || node1.type !== node2.type) return false;

  switch (node1.type) {
    case 'FunctionDeclaration':
    case 'FunctionExpression':
    case 'ArrowFunctionExpression':
      return areNodesStructurallySimilar(node1.body, node2.body);
    case 'BlockStatement':
    case 'Program': 
      if (node1.body.length !== node2.body.length) return false;
      return node1.body.every((childNode, index) => 
        areNodesStructurallySimilar(childNode, node2.body[index]));
    case 'ExpressionStatement':
      return areNodesStructurallySimilar(node1.expression, node2.expression);
    case 'IfStatement':
      return areNodesStructurallySimilar(node1.test, node2.test) &&
             areNodesStructurallySimilar(node1.consequent, node2.consequent) &&
             areNodesStructurallySimilar(node1.alternate, node2.alternate);
    case 'BinaryExpression':
    case 'LogicalExpression':
      return node1.operator === node2.operator &&
             areNodesStructurallySimilar(node1.left, node2.left) &&
             areNodesStructurallySimilar(node1.right, node2.right);
    case 'CallExpression':
      return areNodesStructurallySimilar(node1.callee, node2.callee) &&
             node1.arguments.length === node2.arguments.length &&
             node1.arguments.every((arg, index) => 
               areNodesStructurallySimilar(arg, node2.arguments[index]));
    case 'Literal':
    case 'Identifier':
      return node1.name === node2.name || node1.value === node2.value;
    default:
      return false;
  }
};

const areASTsStructurallySimilar = (ast1, ast2) => {
  return areNodesStructurallySimilar(ast1, ast2);
}

const extractCommonLines = (lines1, lines2) => {
  return lines1.filter(line => lines2.includes(line));
};

const createFunctionFromCommonLines = (commonLines, functionName) => {
  return `function ${functionName}() {\n  ${commonLines.join("\n  ")}\n}\n`;
};

const replaceCommonLinesWithFunctionCall = (lines, commonLines, functionName) => {
  let isCommonLine = false;
  return lines.map(line => {
    if (commonLines.includes(line)) {
      if (!isCommonLine) {
        isCommonLine = true; 
        return `${functionName}();`
      }
      return null; 
    } else {
      isCommonLine = false;
      return line;
    }
  }).filter(line => line !== null).join("\n");
};
const refactorType1 = (codeFragment1, codeFragment2) => {
  const lines1 = codeFragment1.split("\n").map(line => line.trim());
  const lines2 = codeFragment2.split("\n").map(line => line.trim());
  const commonLines = extractCommonLines(lines1, lines2);
  if (commonLines.length > 0) {
    const functionName = "refactoredFunction";
    const newFunction = createFunctionFromCommonLines(commonLines, functionName);
    const newCodeFragment1 = replaceCommonLinesWithFunctionCall(lines1, commonLines, functionName);
    const newCodeFragment2 = replaceCommonLinesWithFunctionCall(lines2, commonLines, functionName);
    return {
      refactored: true,
      codeFragment1: newCodeFragment1,
      codeFragment2: newCodeFragment2,
      refactoredFunction: newFunction,
    };
  }
  return {
    refactored: false,
    codeFragment1,
    codeFragment2,
    refactoredFunction: "",
  };
};
const findCorrespondingNode = (node, rootNode) => {
  let foundNode = null;
  estraverse.traverse(rootNode, {
    enter: (childNode) => {
      if (areNodesStructurallySimilar(node, childNode)) {
        foundNode = childNode;
        this.break();
      }
    }
  });
  return foundNode;
};
const compareASTNodes = (node1, node2) => {
  const varyingParts = { identifiers: new Map(), literals: new Map() };
  estraverse.traverse(node1, {
    enter: (childNode1) => {
      const correspondingNode2 = findCorrespondingNode(childNode1, node2);
      if (!correspondingNode2) {
        return estraverse.VisitorOption.Skip;
      }
      
      switch (childNode1.type) {
        case 'Identifier':
          if (childNode1.name !== correspondingNode2.name) {
            varyingParts.identifiers.set(childNode1.name, correspondingNode2.name);
          }
          break;
        case 'Literal':
          if (childNode1.value !== correspondingNode2.value) {
            varyingParts.literals.set(childNode1.value, correspondingNode2.value);
          }
          break;
      }
    }
  });

  return varyingParts;
};
const extractVaryingParts = (codeFragment1, codeFragment2) => {
  const ast1 = generateAST(codeFragment1);
  const ast2 = generateAST(codeFragment2);
  return compareASTNodes(ast1, ast2);
  
};

const refactorType2 = (codeFragment1, codeFragment2, varyingParts) => {
  let refactoredFragment1 = codeFragment1;
  let refactoredFragment2 = codeFragment2;
  for (const [original, replacement] of Object.entries(varyingParts)) {
    const regex = new RegExp(`\\b${original}\\b`, 'g');
    refactoredFragment1 = refactoredFragment1.replace(regex, replacement);
    refactoredFragment2 = refactoredFragment2.replace(regex, replacement);
  }
  const parameterNames = Object.keys(varyingParts).join(', ');
  const arguments1 = Object.keys(varyingParts).join(', '); 
  const arguments2 = Object.values(varyingParts).join(', ');
  
  const generalizedFunctionBody = '/* Generalized function body based on the operation */';
  const functionName = "refactoredType2Function";
  const newFunction = `function ${functionName}(${parameterNames}) {\n  ${generalizedFunctionBody}\n}`;

  let newCodeFragment1 = `${functionName}(${arguments1});`;
  let newCodeFragment2 = `${functionName}(${arguments2});`;
  
  return {
    refactored: true,
    codeFragment1: newCodeFragment1,
    codeFragment2: newCodeFragment2,
    refactoredFunction: newFunction,
  };
};

router.post("/detect-duplicate-code", async (request, response) => {
  const { filePath } = request.body;
  if (!filePath) {
    return response.status(400).send("File path is required.");
  }
  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    const normalizedContent = normalizeCode(fileContent);
    const codeFragments = normalizedContent.split(/(?=function\s*\w*\s*\()/);
    if (codeFragments[0].trim() === '') {
      codeFragments.shift();
    }
    let responseMessage = "";

    if (codeFragments.length >= 2) {
      // Type-1 Clone Detection and Refactoring
      const setA = new Set(codeFragments[0].split('\n').map(line => line.trim()));
      const setB = new Set(codeFragments[1].split('\n').map(line => line.trim()));
      const similarity = jaccardSimilarity(setA, setB);
      
      if (similarity > 0.75) {
        const result = refactorType1(codeFragments[0], codeFragments[1]);
        responseMessage += "Type-1 duplicated code detected and refactored.\n";
        responseMessage += `Refactored Function:\n${result.refactoredFunction}\n`;
      } else {
        // Type-2 Clone Detection and Refactoring
        const ast1 = generateAST(codeFragments[0]);
        const ast2 = generateAST(codeFragments[1]);
        if (areASTsStructurallySimilar(ast1, ast2)) {
          const varyingParts = extractVaryingParts(ast1, ast2);
          const result = refactorType2(codeFragments[0], codeFragments[1], varyingParts);
          responseMessage += "Type-2 structural duplicate detected and refactored.\n";
          responseMessage += `Refactored Function:\n${result.refactoredFunction}\n`;
        } else {
          responseMessage = "No significant duplicates found.";
        }
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
