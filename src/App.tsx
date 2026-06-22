import { Switch, Route, Router as WouterRouter } from "wouter";
import Navbar from "@/components/features/Navbar";
import Footer from "@/components/features/Footer";
import NotFound from "@/pages/not-found/page";
import { GamePage } from "@/pages/game/page";

function Router() {
  return (
    <Switch>
      <Route path="/" component={GamePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <div className="app-shell">
        <Navbar />
        <main className="app-main">
          <Router />
        </main>
        <Footer />
      </div>
    </WouterRouter>
  );
}

export default App;
