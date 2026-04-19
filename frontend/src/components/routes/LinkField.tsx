import { getEnvHref } from "@/utils/navHelpers";
import { Link, TableCell } from "@mui/material";

function LinkField({
  title,
  id,
  keyVal,
}: {
  title: string;
  id: number;
  keyVal: string;
}) {
  const href = getEnvHref(`/map/${id}`);
  return (
    <TableCell component="th" scope="row" key={keyVal}>
      <Link href={href}>{title}</Link>
    </TableCell>
  );
}

export default LinkField;
