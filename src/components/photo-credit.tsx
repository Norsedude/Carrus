import type { PhotoCredit as Credit } from "@/server/search/types";

/** Short attribution required by Creative Commons licenses: author, license, source link. */
export function PhotoCredit({ credit, className = "" }: { credit?: Credit; className?: string }) {
  if (!credit) return null;
  return (
    <p className={`truncate text-[0.7rem] text-gray-500 ${className}`} data-testid="photo-credit" title={`${credit.title} by ${credit.author}, ${credit.license}, via Wikimedia Commons`}>
      Photo:{" "}
      <a href={credit.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-900">
        {credit.author}
      </a>
      {" · "}
      {credit.licenseUrl ? (
        <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer license" className="underline underline-offset-2 hover:text-gray-900">
          {credit.license}
        </a>
      ) : (
        credit.license
      )}
      {" · Wikimedia Commons"}
    </p>
  );
}
