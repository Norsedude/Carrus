import type { PhotoCredit as Credit } from "@/server/search/types";

/** Attribution line required by Creative Commons licenses. */
export function PhotoCredit({ credit, className = "" }: { credit?: Credit; className?: string }) {
  if (!credit) return null;
  return (
    <p className={`text-xs text-gray-500 ${className}`} data-testid="photo-credit">
      Photo:{" "}
      <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
        {credit.title}
      </a>{" "}
      by {credit.author},{" "}
      {credit.licenseUrl ? (
        <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline">
          {credit.license}
        </a>
      ) : (
        credit.license
      )}
      , via Wikimedia Commons
    </p>
  );
}
