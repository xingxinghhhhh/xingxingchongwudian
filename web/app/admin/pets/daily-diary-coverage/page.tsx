import { SiteHeader } from "../../../components/site-header";
import { AdminAccessGate } from "../../admin-access-gate";
import { DailyDiaryCoverageConsole } from "./daily-diary-coverage-console";

export default function DailyDiaryCoveragePage() {
  return (
    <main className="admin-page">
      <SiteHeader />

      <section className="admin-hero">
        <div className="admin-hero__inner">
          <p className="section__kicker">Cloud Pet Ops</p>
          <h1>Daily Diary Coverage Recovery</h1>
          <p>
            Inspect missing pet diary coverage, recover gaps, and keep the cloud-pet
            retention loop active.
          </p>
        </div>
      </section>

      <section className="admin-section">
        <AdminAccessGate>
          <DailyDiaryCoverageConsole />
        </AdminAccessGate>
      </section>
    </main>
  );
}
