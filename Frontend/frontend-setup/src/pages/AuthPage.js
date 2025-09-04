import React from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useNavigate } from 'react-router-dom';

const AuthPage = () => {
  const { supabaseClient } = useSessionContext();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin, // Redirects back to home page after login
      },
    });
    if (error) {
      console.error("Error logging in with Google:", error.message);
    }
  };

  return (
    <div style={{ paddingTop: '120px', textAlign: 'center' }}>
      <h2>Sign In / Sign Up</h2>
      <p>Please sign in to continue.</p>
      <button 
        onClick={handleGoogleLogin} 
        style={{ padding: '10px 20px', fontSize: '1rem', cursor: 'pointer' }}
      >
        Continue with Google
      </button>
    </div>
  );
};

export default AuthPage;