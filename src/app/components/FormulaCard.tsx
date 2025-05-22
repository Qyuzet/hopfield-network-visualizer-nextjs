// @ts-nocheck
"use client";

import { useState } from "react";
import katex from "katex";

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

  const toggleCode = () => {
    setIsCodeVisible(!isCodeVisible);
  };

  // Render LaTeX formula using KaTeX
  const renderFormula = (latex: string) => {
    return (
      <span dangerouslySetInnerHTML={{ __html: katex.renderToString(latex) }} />
    );
  };

  return (
    <div className="flex-1 min-w-[150px] p-3 sm:p-4 bg-gray-100 rounded-lg shadow-md text-center overflow-hidden">
      <p className="text-base sm:text-lg font-semibold">{title}</p>

      <p className="text-sm sm:text-base break-words overflow-x-auto">
        {renderFormula(formula)}
      </p>
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
