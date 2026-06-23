import { Switch, Route, Router as WouterRouter } from "wouter";
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
        <main className="app-main">
          <Router />
        </main>
      </div>
    </WouterRouter>
  );
}

export default App;
