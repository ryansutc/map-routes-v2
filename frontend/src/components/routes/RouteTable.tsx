import { useRoutes } from "@/hooks/useRoutes";
import { prettyString } from "@/utils/stringHelpers";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import ActivityField from "./ActivityField";
import LinkField from "./LinkField";

export default function RoutesTable() {
  //const user = useStore((state) => state.user);
  //const userIsAuthenticated = useStore((state) => state.userIsAuthenticated);

  const { data: routeItems, isLoading, error, isError } = useRoutes();

  const ignoreFields = ["activity_type", "distance", "is_public", "owner"];
  const fields =
    routeItems &&
    // @ts-expect-error routeItems is not empty
    Object.keys(routeItems[0]).filter((vv) => !ignoreFields.includes(vv));

  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (isError) {
    console.error(error);
    return <div>{`Error Occurred loading table ${error}`}</div>;
  }
  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow>
            {fields &&
              fields.map((field) => {
                return <TableCell key={field}>{prettyString(field)}</TableCell>;
              })}
          </TableRow>
        </TableHead>
        <TableBody>
          {routeItems &&
            routeItems.map((route) => (
              <TableRow
                key={route.id}
                sx={{
                  "&:last-child td, &:last-child th": { border: 0 },
                  backgroundColor: route.is_public ? "lightgrey" : "white",
                }}
              >
                {Object.entries(route).map(([key, val]) => {
                  if (!ignoreFields.includes(key)) {
                    if (key === "activity_date" && val) {
                      return (
                        <ActivityField
                          // @ts-expect-error fieldVal is a string
                          fieldVal={val}
                          keyVal={`${route.id}-${key}`}
                          key={`${route.id}-${key}`}
                        />
                      );
                    } else if (key === "title" && val) {
                      return (
                        <LinkField
                          title={val.toString() ?? "no title"}
                          id={route.id ?? 999}
                          keyVal={`${route.id}-${key}`}
                          key={`${route.id}-${key}`}
                        />
                      );
                    }
                    return (
                      <TableCell
                        key={`${route.id}-${key}`}
                        component="th"
                        scope="row"
                      >
                        <span>{val?.toString()}</span>
                      </TableCell>
                    );
                  }
                })}
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
