import Link from "next/link";
import { PawPrint } from "lucide-react";
import { brandName } from "../content-site-data";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/profiles", label: "档案" },
  { href: "/diary", label: "日记" },
  { href: "/about", label: "关于" },
  { href: "/#future", label: "未来计划" }
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/">
          <span className="brand__mark">
            <PawPrint size={16} />
          </span>
          <span>{brandName}</span>
        </Link>

        <nav className="site-nav" aria-label="Primary">
          {navItems.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
