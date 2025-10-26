import { Button } from '../components/ui/button';

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-semibold">Yolk Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-300">Next.js + Tailwind + shadcn/ui scaffold</p>
        <div className="flex items-center justify-center gap-3">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
        </div>
      </div>
    </main>
  );
}


