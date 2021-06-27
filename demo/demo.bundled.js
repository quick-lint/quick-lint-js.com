(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
  var __require = (x) => {
    if (typeof require !== "undefined")
      return require(x);
    throw new Error('Dynamic require of "' + x + '" is not supported');
  };
  var __commonJS = (cb, mod) => function __require2() {
    return mod || (0, cb[Object.keys(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __reExport = (target, module, desc) => {
    if (module && typeof module === "object" || typeof module === "function") {
      for (let key of __getOwnPropNames(module))
        if (!__hasOwnProp.call(target, key) && key !== "default")
          __defProp(target, key, { get: () => module[key], enumerable: !(desc = __getOwnPropDesc(module, key)) || desc.enumerable });
    }
    return target;
  };
  var __toModule = (module) => {
    return __reExport(__markAsModule(__defProp(module != null ? __create(__getProtoOf(module)) : {}, "default", module && module.__esModule && "default" in module ? { get: () => module.default, enumerable: true } : { value: module, enumerable: true })), module);
  };

  // node_modules/quick-lint-js-wasm/quick-lint-js.js
  var require_quick_lint_js = __commonJS({
    "node_modules/quick-lint-js-wasm/quick-lint-js.js"(exports) {
      "use strict";
      var VSCODE_WASM_MODULE_PATH = "./dist/quick-lint-js-vscode.wasm";
      async function createProcessFactoryAsync2() {
        if (typeof window === "undefined") {
          let fs = __require("fs");
          let path = __require("path");
          let wasmCode = await fs.promises.readFile(path.join(__dirname, VSCODE_WASM_MODULE_PATH));
          let wasmModule = await WebAssembly.compile(wasmCode);
          return new ProcessFactory(wasmModule);
        } else {
          let wasmModule = await WebAssembly.compileStreaming(fetch(VSCODE_WASM_MODULE_PATH));
          return new ProcessFactory(wasmModule);
        }
      }
      exports.createProcessFactoryAsync = createProcessFactoryAsync2;
      var ProcessCrashed = class extends Error {
      };
      exports.ProcessCrashed = ProcessCrashed;
      var ProcessAborted = class extends ProcessCrashed {
      };
      exports.ProcessAborted = ProcessAborted;
      var ProcessCrashedWithUnknownError = class extends ProcessCrashed {
        constructor(originalError) {
          super(originalError.stack);
          this.originalError = originalError;
        }
      };
      exports.ProcessCrashedWithUnknownError = ProcessCrashedWithUnknownError;
      var ProcessFactory = class {
        constructor(wasmModule) {
          this._wasmModule = wasmModule;
        }
        async createProcessAsync() {
          let wasmInstance = await WebAssembly.instantiate(this._wasmModule, {
            wasi_snapshot_preview1: {
              fd_close: () => {
                throw new Error("Not implemented: fd_close");
              },
              fd_read: () => {
                throw new Error("Not implemented: fd_read");
              },
              fd_seek: () => {
                throw new Error("Not implemented: fd_seek");
              },
              environ_get: (environ, environBuf) => {
                return 0;
              },
              environ_sizes_get: (outEnvironc, outEnvironBufSize) => {
                let heap = wasmInstance.exports.memory.buffer;
                new Uint32Array(heap, outEnvironc)[0] = 0;
                new Uint32Array(heap, outEnvironBufSize)[0] = 0;
                return 0;
              },
              proc_exit: () => {
                throw new ProcessAborted("quick-lint-js process exited");
              },
              fd_write: (fd, iovsData, iovsSize, outWrittenSize) => {
                let heap = wasmInstance.exports.memory.buffer;
                let iovs = new Uint32Array(heap, iovsData, iovsSize * 8);
                let bytesWritten = 0;
                for (let i = 0; i < iovsSize; ++i) {
                  let bufferPointer = iovs[i * 2 + 0];
                  let bufferSize = iovs[i * 2 + 1];
                  let buffer = new Uint8Array(heap, bufferPointer, bufferSize);
                  process.stdout.write(buffer);
                  bytesWritten += buffer.byteLength;
                }
                new Uint32Array(heap, outWrittenSize)[0] = bytesWritten;
                return 0;
              }
            }
          });
          wasmInstance.exports._initialize();
          return new Process(wasmInstance);
        }
      };
      var Process = class {
        constructor(wasmInstance) {
          this._wasmInstance = wasmInstance;
          function wrap(name) {
            let func = wasmInstance.exports[name];
            return (...args) => {
              exports.maybeInjectFault(name);
              try {
                return func(...args);
              } catch (e) {
                throw new ProcessCrashedWithUnknownError(e);
              }
            };
          }
          this._heap = wasmInstance.exports.memory.buffer;
          this._malloc = wrap("malloc");
          this._free = wrap("free");
          this._vscodeCreateParser = wrap("qljs_vscode_create_parser");
          this._vscodeDestroyParser = wrap("qljs_vscode_destroy_parser");
          this._vscodeLint = wrap("qljs_vscode_lint");
          this._vscodeReplaceText = wrap("qljs_vscode_replace_text");
          this._webDemoCreateParser = wrap("qljs_web_demo_create_parser");
          this._webDemoDestroyParser = wrap("qljs_web_demo_destroy_parser");
          this._webDemoLint = wrap("qljs_web_demo_lint");
          this._webDemoSetText = wrap("qljs_web_demo_set_text");
        }
        async createParserForVSCodeAsync() {
          return new ParserForVSCode(this);
        }
        async createParserForWebDemoAsync() {
          return new ParserForWebDemo(this);
        }
      };
      var ParserForVSCode = class {
        constructor(process2) {
          this._process = process2;
          this._parser = this._process._vscodeCreateParser();
        }
        replaceText(range, replacementText) {
          let utf8ReplacementText = encodeUTF8String(replacementText, this._process);
          try {
            this._process._vscodeReplaceText(this._parser, range.start.line, range.start.character, range.end.line, range.end.character, utf8ReplacementText.pointer, utf8ReplacementText.byteSize);
          } finally {
            utf8ReplacementText.dispose();
          }
        }
        lint() {
          let diagnosticsPointer = this._process._vscodeLint(this._parser);
          let rawDiagnosticsU32 = new Uint32Array(this._process._heap, diagnosticsPointer);
          let rawDiagnosticsPtr = new Uint32Array(this._process._heap, diagnosticsPointer);
          let ERROR = {
            message: 0,
            code: 1,
            severity: 2,
            start_line: 3,
            start_character: 4,
            end_line: 5,
            end_character: 6,
            _ptr_size: 7,
            _u32_size: 7
          };
          let diagnostics = [];
          for (let i = 0; ; ++i) {
            let messagePtr = rawDiagnosticsPtr[i * ERROR._ptr_size + ERROR.message];
            if (messagePtr === 0) {
              break;
            }
            let codePtr = rawDiagnosticsPtr[i * ERROR._ptr_size + ERROR.code];
            diagnostics.push({
              code: decodeUTF8CString(new Uint8Array(this._process._heap, codePtr)),
              message: decodeUTF8CString(new Uint8Array(this._process._heap, messagePtr)),
              severity: rawDiagnosticsU32[i * ERROR._u32_size + ERROR.severity],
              startLine: rawDiagnosticsU32[i * ERROR._u32_size + ERROR.start_line],
              startCharacter: rawDiagnosticsU32[i * ERROR._u32_size + ERROR.start_character],
              endLine: rawDiagnosticsU32[i * ERROR._u32_size + ERROR.end_line],
              endCharacter: rawDiagnosticsU32[i * ERROR._u32_size + ERROR.end_character]
            });
          }
          return diagnostics;
        }
        dispose() {
          this._process._vscodeDestroyParser(this._parser);
          this._parser = null;
        }
      };
      var ParserForWebDemo = class {
        constructor(process2) {
          this._process = process2;
          this._parser = this._process._webDemoCreateParser();
        }
        setText(text) {
          let utf8Text = encodeUTF8String(text, this._process);
          try {
            this._process._webDemoSetText(this._parser, utf8Text.pointer, utf8Text.byteSize);
          } finally {
            utf8Text.dispose();
          }
        }
        lint() {
          let diagnosticsPointer = this._process._webDemoLint(this._parser);
          let rawDiagnosticsU32 = new Uint32Array(this._process._heap, diagnosticsPointer);
          let rawDiagnosticsPtr = new Uint32Array(this._process._heap, diagnosticsPointer);
          let ERROR = {
            message: 0,
            code: 1,
            severity: 2,
            begin_offset: 3,
            end_offset: 4,
            _ptr_size: 5,
            _u32_size: 5
          };
          let diagnostics = [];
          for (let i = 0; ; ++i) {
            let messagePtr = rawDiagnosticsPtr[i * ERROR._ptr_size + ERROR.message];
            if (messagePtr === 0) {
              break;
            }
            let codePtr = rawDiagnosticsPtr[i * ERROR._ptr_size + ERROR.code];
            diagnostics.push({
              code: decodeUTF8CString(new Uint8Array(this._process._heap, codePtr)),
              message: decodeUTF8CString(new Uint8Array(this._process._heap, messagePtr)),
              severity: rawDiagnosticsU32[i * ERROR._u32_size + ERROR.severity],
              begin: rawDiagnosticsU32[i * ERROR._u32_size + ERROR.begin_offset],
              end: rawDiagnosticsU32[i * ERROR._u32_size + ERROR.end_offset]
            });
          }
          return diagnostics;
        }
        dispose() {
          this._process._webDemoDestroyParser(this._parser);
          this._parser = null;
        }
      };
      var DiagnosticSeverity = {
        ERROR: 1,
        WARNING: 2
      };
      exports.DiagnosticSeverity = DiagnosticSeverity;
      function encodeUTF8String(string, process2) {
        let maxUTF8BytesPerUTF16CodeUnit = Math.ceil(Math.max(3 / 1, 5 / 2));
        let maxSize = string.length * maxUTF8BytesPerUTF16CodeUnit;
        let textUTF8Pointer = process2._malloc(maxSize);
        try {
          let encoder = new TextEncoder();
          let encodeResult = encoder.encodeInto(string, new Uint8Array(process2._heap, textUTF8Pointer, maxSize));
          if (encodeResult.read !== string.length) {
            throw new Error(`Assertion failure: expected encodeResult.read (${encodeResult.read}) to equal string.length (${string.length})`);
          }
          let textUTF8Size = encodeResult.written;
          return {
            pointer: textUTF8Pointer,
            byteSize: textUTF8Size,
            dispose
          };
        } catch (e) {
          dispose();
          throw e;
        }
        function dispose() {
          process2._free(textUTF8Pointer);
        }
      }
      function decodeUTF8CString(bytes) {
        let nullTerminatorIndex = bytes.indexOf(0);
        if (nullTerminatorIndex < 0) {
          throw new Error("null terminator not found in C string");
        }
        return new TextDecoder().decode(bytes.subarray(0, nullTerminatorIndex));
      }
      exports.maybeInjectFault = () => {
      };
    }
  });

  // public/demo/demo.mjs
  var import_quick_lint_js = __toModule(require_quick_lint_js());

  // public/demo/editor.mjs
  function markEditorText(editor, window2, marks) {
    let marker = new EditorMarker(editor, window2, sanitizeMarks(marks));
    marker.markNodes();
  }
  function sanitizeMarks(marks) {
    let result = [];
    for (let mark of marks) {
      let markAlreadyExists = result.some((resultMark) => resultMark.begin === mark.begin && resultMark.end == mark.end);
      if (markAlreadyExists) {
        continue;
      }
      result.push(mark);
    }
    result.sort((a, b) => {
      if (a.begin < b.begin) {
        return -1;
      }
      if (a.begin > b.begin) {
        return 1;
      }
      return 0;
    });
    return result;
  }
  var EditorMarker = class {
    constructor(editor, window2, marks) {
      this._editor = editor;
      this._window = window2;
      this._marks = marks;
      this._currentOffset = 0;
      this._currentMarkIndex = 0;
      this._markBeginNode = null;
      this._markEndNode = null;
    }
    markNodes() {
      let currentNode = this._editor.firstChild;
      while (currentNode !== null) {
        switch (currentNode.nodeType) {
          case this._window.Node.ELEMENT_NODE:
            currentNode = this.handleElement(currentNode);
            break;
          case this._window.Node.TEXT_NODE:
            currentNode = this.handleTextNode(currentNode);
            break;
          default:
            throw new Error("Unsupported node type");
        }
      }
    }
    handleElement(currentNode) {
      if (currentNode.tagName === "BR") {
        this._currentOffset += 1;
        return currentNode.nextSibling;
      } else {
        return this.handleElementWithChildren(currentNode);
      }
    }
    handleElementWithChildren(currentNode) {
      let currentNodeIndex = indexOfChildNode(this._editor, currentNode);
      let previousSibling = currentNode.previousSibling;
      let childNodes = [...currentNode.childNodes];
      currentNode.replaceWith(...childNodes);
      if (previousSibling === null) {
        return this._editor.firstChild;
      } else {
        return previousSibling.nextSibling;
      }
    }
    handleTextNode(currentNode) {
      let self = this;
      let currentMark = this._currentMarkIndex < this._marks.length ? this._marks[this._currentMarkIndex] : null;
      if (currentMark !== null) {
        if (currentNodeContainsOffset(currentMark.begin)) {
          let splitIndex = currentMark.begin - self._currentOffset;
          this._markBeginNode = splitNodeAtMarkBegin(splitIndex);
        }
        if (currentNodeContainsOffset(currentMark.end)) {
          let splitIndex = currentMark.end - this._currentOffset;
          this._markEndNode = splitNodeAtMarkEnd(splitIndex);
          let mark = this._window.document.createElement("mark");
          if (currentMark.message && currentMark.code && currentMark.severity) {
            mark.setAttribute("data-message", currentMark.message);
            mark.setAttribute("data-code", currentMark.code);
            mark.setAttribute("data-severity", currentMark.severity);
          }
          if (this._markBeginNode === this._markEndNode.nextSibling) {
            if (currentMark.begin !== currentMark.end) {
              throw new Error("Unexpected: markBeginNode comes after markEndNode, but this should only happen if the current mark is empty");
            }
            this._editor.insertBefore(mark, this._markBeginNode);
          } else {
            wrapNodes(mark, this._markBeginNode, this._markEndNode);
          }
          this._currentMarkIndex += 1;
          this._currentOffset += splitIndex;
          return mark.nextSibling;
        }
      }
      this._currentOffset += currentNode.textContent.length;
      return currentNode.nextSibling;
      function currentNodeContainsOffset(offset) {
        let currentNodeBeginOffset = self._currentOffset;
        let currentNodeEndOffset = currentNodeBeginOffset + currentNode.length;
        return currentNodeBeginOffset <= offset && offset <= currentNodeEndOffset;
      }
      function splitNodeAtMarkBegin(splitIndex) {
        if (splitIndex === 0) {
          return currentNode;
        } else if (splitIndex === currentNode.textContent.length) {
          if (currentNode.nextSibling === null) {
            throw new Error("Can't happen");
          } else {
            return currentNode.nextSibling;
          }
        } else {
          let nextNode = splitTextNode(currentNode, splitIndex, self._window);
          return nextNode;
        }
      }
      function splitNodeAtMarkEnd(splitIndex) {
        if (splitIndex === 0) {
          return currentNode.previousSibling;
        } else if (splitIndex === currentNode.textContent.length) {
          return currentNode;
        } else {
          let nextNode = splitTextNode(currentNode, splitIndex, self._window);
          return currentNode;
        }
      }
    }
  };
  function indexOfChildNode(parentNode, childNode) {
    let i = 0;
    let n = parentNode.firstChild;
    for (; ; ) {
      if (n === null) {
        return null;
      }
      if (n === childNode) {
        return i;
      }
      n = n.nextSibling;
      ++i;
    }
  }
  function splitTextNode(node, index, window2) {
    let text = node.textContent;
    let leftText = text.substr(0, index);
    if (leftText === "") {
      throw new Error("Cannot split node at beginning");
    }
    let rightText = text.substr(index);
    if (rightText === "") {
      throw new Error("Cannot split node at end");
    }
    let rightNode = window2.document.createTextNode(rightText);
    node.parentNode.insertBefore(rightNode, node.nextSibling);
    node.textContent = leftText;
    return rightNode;
  }
  function wrapNodes(wrapperElement, firstChildNode, lastChildNode) {
    lastChildNode.parentNode.insertBefore(wrapperElement, lastChildNode.nextSibling);
    for (let n = firstChildNode; n !== null; ) {
      let next = n.nextSibling;
      wrapperElement.appendChild(n);
      if (n === lastChildNode) {
        break;
      }
      n = next;
    }
  }

  // public/demo/demo.mjs
  var codeInputElement = document.getElementById("code-input");
  var shadowCodeInputElement = document.getElementById("shadow-code-input");
  codeInputElement.addEventListener("scroll", (event) => {
    synchronizeScrolling();
  });
  synchronizeContent();
  if (typeof window.ResizeObserver !== "undefined") {
    new window.ResizeObserver(synchronizeSize).observe(codeInputElement);
  }
  (0, import_quick_lint_js.createProcessFactoryAsync)().then(async (processFactory) => {
    let process2 = await processFactory.createProcessAsync();
    let parser = await process2.createParserForWebDemoAsync();
    function lintAndUpdate() {
      synchronizeContent();
      let input = codeInputElement.value;
      parser.setText(input);
      let marks = parser.lint();
      markEditorText(shadowCodeInputElement, window, marks);
    }
    codeInputElement.addEventListener("input", (event) => {
      lintAndUpdate();
    });
    lintAndUpdate();
  }).catch((error) => {
    console.error(error);
  });
  function synchronizeContent() {
    let input = codeInputElement.value;
    shadowCodeInputElement.textContent = input + "\n\n\n";
  }
  function synchronizeScrolling() {
    shadowCodeInputElement.scrollLeft = codeInputElement.scrollLeft;
    shadowCodeInputElement.scrollTop = codeInputElement.scrollTop;
  }
  function synchronizeSize() {
    shadowCodeInputElement.style.width = codeInputElement.style.width;
    shadowCodeInputElement.style.height = codeInputElement.style.height;
  }
  function showErrorMessageBox(mark, posCursorX) {
    const div = createErrorBox(mark, posCursorX, mark.attributes["data-message"].value, mark.attributes["data-code"].value, mark.attributes["data-severity"].value);
    let body = document.querySelector("body");
    body.appendChild(div);
  }
  function createErrorBox(markedElement, posCursorX, errorMessage, code, severity) {
    let div = document.createElement("div");
    const { bottom } = markedElement.getBoundingClientRect();
    div.setAttribute("id", "error-box");
    div.innerText = `${code} - ${errorMessage}`;
    div.style.position = "fixed";
    div.style.overflow = "auto";
    div.style.top = `${Math.trunc(bottom)}px`;
    div.style.left = `${posCursorX}px`;
    return div;
  }
  function removeErrorMessageBox() {
    document.querySelector("#error-box")?.remove();
  }
  function showErrorMessage(event) {
    removeErrorMessageBox();
    const shadowInput = document.querySelector("#shadow-code-input");
    const marks = shadowInput.querySelectorAll("mark");
    for (let mark of marks) {
      const markRect = mark.getBoundingClientRect();
      if (cursorOverMark(event.clientX, event.clientY, markRect)) {
        showErrorMessageBox(mark, event.clientX);
        break;
      }
    }
  }
  function cursorOverMark(cursorPosX, cursorPosY, markRect) {
    const topDownIn = markRect.bottom >= cursorPosY && cursorPosY >= markRect.top;
    const leftRightIn = cursorPosX >= markRect.left && cursorPosX <= markRect.left + markRect.width;
    return topDownIn && leftRightIn;
  }
  document.addEventListener("DOMContentLoaded", () => {
    const codeInput = document.querySelector("#code-input");
    codeInput.addEventListener("mousemove", showErrorMessage);
    codeInput.addEventListener("input", removeErrorMessageBox);
    codeInput.addEventListener("click", removeErrorMessageBox);
    codeInput.addEventListener("mouseout", removeErrorMessageBox);
  });
})();
