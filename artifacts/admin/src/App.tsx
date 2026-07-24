import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { setAuthTokenGetter } from '@workspace/api-client-react';

// Attach Bearer token to every API request made by the shared API client.
// The token is stored in localStorage after a successful admin login.
setAuthTokenGetter(() => localStorage.getItem('admin_token'));

import { AdminLayout } from '@/components/AdminLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Stations from '@/pages/Stations';
import Operators from '@/pages/Operators';
import Sessions from '@/pages/Sessions';
import Users from '@/pages/Users';
import Support from '@/pages/Support';
import Vehicles from '@/pages/Vehicles';
import Promos from '@/pages/Promos';
import Banners from '@/pages/Banners';
import Finance from '@/pages/Finance';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <AdminLayout>
          <Dashboard />
        </AdminLayout>
      </Route>
      <Route path="/stations">
        <AdminLayout>
          <Stations />
        </AdminLayout>
      </Route>
      <Route path="/operators">
        <AdminLayout>
          <Operators />
        </AdminLayout>
      </Route>
      <Route path="/sessions">
        <AdminLayout>
          <Sessions />
        </AdminLayout>
      </Route>
      <Route path="/users">
        <AdminLayout>
          <Users />
        </AdminLayout>
      </Route>
      <Route path="/vehicles">
        <AdminLayout>
          <Vehicles />
        </AdminLayout>
      </Route>
      <Route path="/support">
        <AdminLayout>
          <Support />
        </AdminLayout>
      </Route>
      <Route path="/promos">
        <AdminLayout>
          <Promos />
        </AdminLayout>
      </Route>
      <Route path="/banners">
        <AdminLayout>
          <Banners />
        </AdminLayout>
      </Route>
      <Route path="/finance">
        <AdminLayout>
          <Finance />
        </AdminLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
