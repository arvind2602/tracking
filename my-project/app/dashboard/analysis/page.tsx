import Breadcrumbs from "@/components/ui/breadcrumbs";

export default function Analysis() {
  const breadcrumbItems = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Analysis", href: "/dashboard/analysis" },
  ];

  return (
    <div className="font-mono">
      <Breadcrumbs items={breadcrumbItems} />
      <h1 className="text-4xl font-bold text-white mb-8 mt-4">Analysis</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="bg-card/50 backdrop-blur-lg p-6 rounded-xl border border-accent/20 shadow-lg">
          <h2 className="text-lg font-medium text-accent mb-4">Employee Performance</h2>
          <div className="bg-background/50 rounded-lg h-64 flex items-center justify-center border border-accent/20">
            <p className="text-accent/50">Chart placeholder</p>
          </div>
        </div>
        <div className="bg-card/50 backdrop-blur-lg p-6 rounded-xl border border-accent/20 shadow-lg">
          <h2 className="text-lg font-medium text-accent mb-4">Project Progress</h2>
          <div className="bg-background/50 rounded-lg h-64 flex items-center justify-center border border-accent/20">
            <p className="text-accent/50">Chart placeholder</p>
          </div>
        </div>
        <div className="bg-card/50 backdrop-blur-lg p-6 rounded-xl border border-accent/20 shadow-lg">
          <h2 className="text-lg font-medium text-accent mb-4">Task Distribution</h2>
          <div className="bg-background/50 rounded-lg h-64 flex items-center justify-center border border-accent/20">
            <p className="text-accent/50">Chart placeholder</p>
          </div>
        </div>
      </div>
    </div>
  );
}
