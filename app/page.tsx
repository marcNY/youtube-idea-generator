import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
export default function WelcomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white">
      <div className="container mx-auto px-4 text-center">
        <h1 className="mb-6 text-5xl font-bold bg-gradient-to-r from-red-600 to-red-400 bg-clip-text text-transparent md:text-6xl lg:text-7xl">
          Transform your Youtube Strategy
        </h1>
        <p className="mb-8 text-xl text-gray-600">
          Take your YouTube content to the next level with data-driven insights
        </p>
        <Link href="/videos">
          <Button className="rounded-full bg-gradient-to-r from-red-600 to-red-400 px-8 py-4 text-lg font-semibold text-white transition-all hover:from-red-700 hover:to-red-400 hover:-translate-y-0.5 hover:shadow-lg shadow-md">
            Get Started Free
          </Button>
        </Link>
      </div>
    </main>
  );
}
