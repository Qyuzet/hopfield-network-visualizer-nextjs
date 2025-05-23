// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import "katex/dist/katex.min.css";

interface FormulaCardProps {
  title: string;
  formula: string;
  code: string;
}

export default function FormulaCard({
  title,
  formula,
  code,
}: FormulaCardProps) {
  const [isCodeVisible, setIsCodeVisible] = useState(false);
  const [formulaHtml, setFormulaHtml] = useState<string>("");

  const toggleCode = () => {
    setIsCodeVisible(!isCodeVisible);
  };

  // Use client-side rendering for KaTeX
  useEffect(() => {
    // Import KaTeX dynamically on the client side
    import("katex").then((katex) => {
      try {
        const html = katex.default.renderToString(formula, {
          displayMode: true,
          throwOnError: false,
          trust: true,
          output: "html",
          macros: {
            "\\sign": "\\operatorname{sign}",
          },
          strict: false,
          minRuleThickness: 0.08,
          maxSize: 20,
          maxExpand: 1000,
          fleqn: false,
        });
        setFormulaHtml(html);
      } catch (error) {
        console.error("KaTeX rendering error:", error);
        setFormulaHtml(
          `<span style="color: red;">Error rendering formula</span>`
        );
      }
    });
  }, [formula]);

  return (
    <div className="flex-1 min-w-[200px] p-3 sm:p-4 bg-gray-100 rounded-lg shadow-md text-center overflow-hidden">
      <p className="text-base sm:text-lg font-semibold">{title}</p>

      {/* Formula container with fixed height to prevent layout shifts */}
      <div
        className="text-sm sm:text-base my-4 flex justify-center items-center min-h-[80px] w-full overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: formulaHtml }}
      />

      <button
        className="mt-2 text-blue-500 hover:text-blue-700 text-xs sm:text-sm"
        onClick={toggleCode}
      >
        {isCodeVisible ? "Hide Code" : "Show Code"}
      </button>
      {isCodeVisible && (
        <pre className="mt-2 text-xs sm:text-sm text-gray-600 bg-gray-200 p-2 rounded-lg break-words overflow-auto max-h-32 sm:max-h-48">
          {code}
        </pre>
      )}
    </div>
  );
}
