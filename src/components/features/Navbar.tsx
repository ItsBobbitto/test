import { Link, useLocation } from "wouter";
import { Gamepad2, Radio } from "lucide-react";

const navItems = [
  { href: "/", label: "Game", icon: Gamepad2 },
];

export default function Navbar() {
  const [location] = useLocation();

  return (
    <header className="site-nav">
      <Link href="/" className="brand-mark" aria-label="Chat Event Sparks home">
        <span className="brand-orb">
          <Radio size={18} />
        </span>
        <span>
          <strong>Chat Sparks</strong>
          <small>Chat Event Sparks</small>
        </span>
      </Link>

      <nav className="nav-links" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location === item.href;
          return (
            <Link key={item.href} href={item.href} className={active ? "nav-link active" : "nav-link"}>
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
