import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';
import HelpRequests from './pages/HelpRequests';
import HelpRequestDetail from './pages/HelpRequestDetail';
import CreditHistory from './pages/CreditHistory';
import SkillDiscovery from './pages/SkillDiscovery';

export default function App() {
  return (
    <AuthProvider>
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={
            <ProtectedRoute roles={['student']}><StudentDashboard /></ProtectedRoute>
          } />
          <Route path="/faculty" element={
            <ProtectedRoute roles={['faculty']}><FacultyDashboard /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/profile/:userId" element={
            <ProtectedRoute><Profile /></ProtectedRoute>
          } />
          <Route path="/tasks" element={
            <ProtectedRoute><Tasks /></ProtectedRoute>
          } />
          <Route path="/tasks/:id" element={
            <ProtectedRoute><TaskDetail /></ProtectedRoute>
          } />
          <Route path="/help" element={
            <ProtectedRoute><HelpRequests /></ProtectedRoute>
          } />
          <Route path="/help/:id" element={
            <ProtectedRoute><HelpRequestDetail /></ProtectedRoute>
          } />
          <Route path="/credits" element={
            <ProtectedRoute roles={['student']}><CreditHistory /></ProtectedRoute>
          } />
          <Route path="/skills" element={
            <ProtectedRoute roles={['student']}><SkillDiscovery /></ProtectedRoute>
          } />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </AuthProvider>
  );
}
