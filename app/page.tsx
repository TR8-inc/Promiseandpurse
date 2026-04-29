import { fetchLineage, fetchSignals, fetchDisbursements } from "../pipelines/07_agent/tools";
import { fetchMatrix, fetchTransactionTrace, fetchCompanyTrace } from "../pipelines/07_agent/data";
import { TraceCard } from "./components/TraceCard";
import { CompanyTraceCard } from "./components/CompanyTraceCard";
import { SignalsPanel } from "./components/SignalsPanel";
import { RecipientsTable } from "./components/RecipientsTable";
import { Navigators } from "./components/Navigators";
import { ModeToggle } from "./components/ModeToggle";
import { ChatDrawer } from "./components/ChatDrawer";
import { GraphView } from "./components/GraphView";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

function pickStr(sp: SP, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const mode = (pickStr(sp, "mode") ?? "trace") as "trace" | "graph";
  const program = pickStr(sp, "program") ?? "izev";
  const fyStr = pickStr(sp, "fy") ?? "2024";
  const fy = parseInt(fyStr, 10);
  const disb_id = pickStr(sp, "disb_id");
  const recipient = pickStr(sp, "recipient");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 px-5 sm:px-8 py-6 max-w-[1500px] w-full mx-auto">
        {mode === "graph" ? (
          <GraphView />
        ) : (
          <TraceMode program={program} fy={fy} disb_id={disb_id} recipient={recipient} />
        )}
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="px-5 sm:px-8 py-4 border-b border-zinc-800/80 flex items-center justify-between sticky top-0 bg-zinc-950/80 backdrop-blur z-30">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold mono">
          P&P
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-100 truncate">Promise &amp; Purse</div>
          <div className="text-[11px] text-zinc-500 truncate">Trace federal dollars · Throne → Budget → Estimates → Disbursement</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ModeToggle />
        <ChatDrawer />
      </div>
    </header>
  );
}

async function TraceMode({
  program,
  fy,
  disb_id,
  recipient,
}: {
  program: string;
  fy: number;
  disb_id?: string;
  recipient?: string;
}) {
  // Company trace (?recipient=…) takes priority — its top program drives the sidebar.
  const matrix = await fetchMatrix();

  if (recipient) {
    const company = await fetchCompanyTrace(recipient);
    const top = company.programs[0];
    const sidebarProgram = top?.program_id ?? program;
    const sidebarFy = top?.fy ?? fy;
    const sidebarDisbs = await fetchDisbursements(sidebarProgram, sidebarFy, 10);
    const sidebarSignals = top?.signals ?? (await fetchSignals(sidebarProgram, sidebarFy));

    return (
      <div className="space-y-6">
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-6 min-w-0">
            <CompanyTraceCard trace={company} />
            <Navigators cells={matrix} />
          </div>
          <aside className="space-y-6">
            <SignalsPanel signals={sidebarSignals} />
            <RecipientsTable disbursements={sidebarDisbs} programId={sidebarProgram} fy={sidebarFy} />
          </aside>
        </div>
      </div>
    );
  }

  const txTracePromise = disb_id ? fetchTransactionTrace(disb_id) : null;
  const lineagePromise = fetchLineage(program, fy);
  const signalsPromise = fetchSignals(program, fy);
  const disbsPromise = fetchDisbursements(program, fy, 10);

  const [txTrace, lineageDirect, signalsDirect, disbs] = await Promise.all([
    txTracePromise,
    lineagePromise,
    signalsPromise,
    disbsPromise,
  ]);

  const lineage = txTrace?.found && txTrace.lineage ? txTrace.lineage : lineageDirect;
  const signals = txTrace?.found && txTrace.signals ? txTrace.signals : signalsDirect;
  const effectiveProgram = txTrace?.program_id ?? program;
  const effectiveFy = txTrace?.fy ?? fy;
  const finalDisbs =
    txTrace?.found && txTrace.program_id && txTrace.program_id !== program
      ? await fetchDisbursements(txTrace.program_id, txTrace.fy ?? fy, 10)
      : disbs;

  const programLabel = lineage.found ? `${lineage.display_name} · FY ${effectiveFy}` : effectiveProgram;

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6 min-w-0">
          <TraceCard
            lineage={lineage}
            topRow={
              txTrace?.found && txTrace.disbursement
                ? {
                    kind: "transaction",
                    data: {
                      id: txTrace.disbursement.id,
                      ref_number: txTrace.disbursement.ref_number,
                      recipient: txTrace.disbursement.recipient,
                      amount_cad: txTrace.disbursement.amount_cad,
                      start_date: txTrace.disbursement.start_date,
                      purpose: txTrace.disbursement.purpose,
                    },
                    programLabel,
                  }
                : {
                    kind: "program",
                    data: {
                      total: finalDisbs.calendar_year_total_cad,
                      count: finalDisbs.agreement_count,
                      topRecipient: finalDisbs.top_recipients[0]
                        ? { name: finalDisbs.top_recipients[0].recipient, amount: finalDisbs.top_recipients[0].total_cad }
                        : undefined,
                    },
                  }
            }
          />
          <Navigators cells={matrix} />
        </div>
        <aside className="space-y-6">
          <SignalsPanel signals={signals} />
          <RecipientsTable disbursements={finalDisbs} programId={effectiveProgram} fy={effectiveFy} />
        </aside>
      </div>
    </div>
  );
}
