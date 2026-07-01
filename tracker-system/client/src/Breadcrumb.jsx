// Sticky breadcrumb strip — shows location: page (+ tab if any).
import React from "react";
import { Icon, ICONS } from "./components.jsx";

export function Breadcrumb({ page, subSection }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        <li className="breadcrumb-item"><span className="breadcrumb-home">Workspace</span></li>
        <li className="breadcrumb-sep" aria-hidden="true"><Icon d={ICONS.chevDown} size={11} style={{ transform: "rotate(-90deg)" }} /></li>
        <li className="breadcrumb-item breadcrumb-current" aria-current="page">{page}</li>
        {subSection ? (
          <React.Fragment>
            <li className="breadcrumb-sep" aria-hidden="true"><Icon d={ICONS.chevDown} size={11} style={{ transform: "rotate(-90deg)" }} /></li>
            <li className="breadcrumb-item">{subSection}</li>
          </React.Fragment>
        ) : null}
      </ol>
    </nav>
  );
}
