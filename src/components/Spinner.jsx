import { RingLoader } from "react-spinners";

function accentColor() {
  if (typeof window === "undefined") return "#26c8ec";
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue("--accent")
      .trim() || "#26c8ec"
  );
}

// Loader da página: o mesmo "ring" do Gerando, porém maior.
export default function Spinner() {
  return (
    <div className="page-loader">
      <RingLoader color={accentColor()} size={54} />
    </div>
  );
}
