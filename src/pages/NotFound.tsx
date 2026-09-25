import { Link } from "react-router-dom";
import { Logo } from "../components/ui";

export default function NotFound() {
  return (
    <>
      <nav className="nav"><Logo /></nav>
      <div className="section center">
        <p className="eyebrow">404</p>
        <h1 className="h2">This page isn't on the resume.</h1>
        <p className="lead" style={{ margin: "0 auto 24px" }}>The link may be old or mistyped.</p>
        <Link className="btn btn--lg" to="/">Back to QuickResume</Link>
      </div>
    </>
  );
}
