import { formatDate } from "@/utils/datetimeHelpers";
import { TableCell } from "@mui/material";

function ActivityField({
  fieldVal,
  keyVal,
}: {
  fieldVal: string;
  keyVal: string;
}) {
  return (
    <TableCell component="th" scope="row" key={keyVal}>
      {formatDate(fieldVal, "mmm-dd-yyyy")}
    </TableCell>
  );
}

export default ActivityField;
