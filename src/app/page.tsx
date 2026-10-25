import { Suspense } from "react";
import UniverseHome from "@/components/universe/universe-home";
import { UniverseLoading } from "@/components/universe/universe-fallback";
import "@/components/universe/universe.css";
export default function HomePage() {
 return <Suspense fallback={<UniverseLoading />}><UniverseHome /></Suspense>;
}
