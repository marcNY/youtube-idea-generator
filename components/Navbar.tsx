"use client";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@clerk/nextjs";
import { SettingsModal } from "@/components/SettingsModal";
import { cn } from "@/lib/utils";
import { FC } from "react";

export default function Navbar() {
  const { isSignedIn } = useAuth();

  return (
    <nav className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Left side - Logo and Links */}
          <div className="flex items-center space-x-8">
            <Link href="/">
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-red-500">
                  VideoApp
                </span>
              </div>
            </Link>
            {isSignedIn && (
              <div className="hidden md:flex space-x-6">
                <Link href="/videos">
                  <Button
                    variant="ghost"
                    className="text-gray-600 hover:text-gray-900 text-base"
                  >
                    Videos
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  className="text-gray-600 hover:text-gray-900 text-base"
                >
                  Explore
                </Button>
              </div>
            )}
          </div>

          {/* Right side - User Profile */}
          <div className="flex items-center space-x-6">
            {isSignedIn ? (
              <div className="flex items-center space-x-6">
                <Button
                  variant="outline"
                  className="hidden md:flex border-red-500 text-red-500 hover:bg-red-50"
                >
                  Upload Video
                </Button>
                <SettingsModal />
                <UserButton
                  afterSignOutUrl="/"
                  userProfileUrl="/profile"
                  appearance={{
                    elements: {
                      userButtonPopoverCard:
                        "bg-white shadow-xl rounded-lg border",
                      userButtonTrigger: "focus:outline-none hover:opacity-80",
                    },
                  }}
                />
              </div>
            ) : (
              <Link href="/sign-in">
                <Button className="bg-red-500 hover:bg-red-600 text-white font-semibold px-8">
                  Get Started
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
