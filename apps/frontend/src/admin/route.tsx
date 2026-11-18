import { lazy, Suspense } from "react";
const Admin = lazy(() => import("./view").then((module) => ({ default: module.AdminApp })));
export function AdminRoute() {
  return (
    <Suspense>
      <Admin />
    </Suspense>
  );
}
