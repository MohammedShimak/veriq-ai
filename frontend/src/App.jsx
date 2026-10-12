import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NewCase from "./pages/NewCase";
import InvestigationView from "./pages/InvestigationView";
import FinalCaseOutcome from "./pages/FinalCaseOutcome";
import DebateStream from "./pages/DebateStream";
import Verdict from "./pages/Verdict";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import AdminAnalytics from "./pages/AdminAnalytics";
import StyleGuide from "./pages/StyleGuide";
import AboutUs from "./pages/AboutUs";
import HelpHub from "./pages/HelpHub";
import ConsumerHelpHub from "./pages/ConsumerHelpHub";
import ConsumerRights from "./pages/ConsumerRights";
import LegalResources from "./pages/LegalResources";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Brand & Educational Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/help-hub" element={<ConsumerHelpHub />} />
            <Route path="/consumer-rights" element={<ConsumerRights />} />
            <Route path="/legal-resources" element={<LegalResources />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Information & Design System */}
            <Route path="/about-us" element={<AboutUs />} />
            <Route path="/style-guide" element={<StyleGuide />} />

            {/* Protected Case Intake & Management Routes */}
            <Route
              path="/start-case"
              element={
                <ProtectedRoute>
                  <NewCase />
                </ProtectedRoute>
              }
            />
            <Route
              path="/new-case"
              element={
                <ProtectedRoute>
                  <NewCase />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-cases"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* Main Investigation & Adjudication Routes */}
            <Route
              path="/investigation/:threadId"
              element={
                <ProtectedRoute>
                  <InvestigationView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/investigation/:threadId/outcome"
              element={
                <ProtectedRoute>
                  <FinalCaseOutcome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/case/:threadId/outcome"
              element={
                <ProtectedRoute>
                  <FinalCaseOutcome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/courtroom"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />
            <Route
              path="/courtroom/:threadId"
              element={
                <ProtectedRoute>
                  <InvestigationView />
                </ProtectedRoute>
              }
            />
            <Route
              path="/courtroom/:threadId/outcome"
              element={
                <ProtectedRoute>
                  <FinalCaseOutcome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/debate/:threadId"
              element={
                <ProtectedRoute>
                  <DebateStream />
                </ProtectedRoute>
              }
            />
            <Route
              path="/verdict/:threadId"
              element={
                <ProtectedRoute>
                  <Verdict />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />

            {/* Admin Dedicated Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminAnalytics defaultTab="overview" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/overview"
              element={
                <ProtectedRoute>
                  <AdminAnalytics defaultTab="overview" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <AdminAnalytics defaultTab="users" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/cases"
              element={
                <ProtectedRoute>
                  <AdminAnalytics defaultTab="cases" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/feedback"
              element={
                <ProtectedRoute>
                  <AdminAnalytics defaultTab="feedback" />
                </ProtectedRoute>
              }
            />

            {/* Fallback Catch-all Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;