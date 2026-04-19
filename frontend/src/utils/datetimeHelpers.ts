type formatType = "yyyy-mm-dd" | "mmm-dd-yyyy" | "mmm-yyyy";
/**
 * Take a date object or ISO string like 2007-04-25T07:00:00.000Z
 * and format it as YYY-MM-DD for pretty display.
 *
 * Does not respect local timezone, always returns UTC date.
 *
 * @param date
 * @returns yyy-mm-dd
 */
export const formatDate = (
  dateString: string | Date,
  format: formatType = "yyyy-mm-dd"
): string => {
  const date = new Date(dateString);
  if (format === "mmm-dd-yyyy") {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return date.toLocaleDateString("en-US", options);
  } else if (format === "mmm-yyyy") {
    // return a date string in the format of "April 2023"
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: undefined,
    };
    return date.toLocaleDateString("en-US", options);
  }

  return date.toISOString().split("T")[0]!;
};
