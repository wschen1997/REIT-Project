// src/pages/AuthPage.js
import React, { useState } from 'react';
import { useSessionContext } from '@supabase/auth-helpers-react';
import { useNavigate } from 'react-router-dom';

const AuthPage = () => {
  const { supabaseClient } = useSessionContext();
  const navigate = useNavigate();

  // State for the form
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // State for messages and errors
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setError(error.message);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (isSignUp) {
      // --- Sign Up Logic ---
      const { data, error } = await supabaseClient.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            full_name: fullName, // This saves the name to user_metadata
          },
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage('Sign up successful! Please check your email to confirm your account.');
      }
    } else {
      // --- Sign In Logic ---
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        setError(error.message);
      } else {
        // On successful sign-in, navigate to the user account page or home page
        navigate('/user');
      }
    }
  };

  return (
    <div style={{ paddingTop: '120px', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
      <h2>{isSignUp ? 'Create an Account' : 'Sign In'}</h2>
      
      {/* Email and Password Form */}
      <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        {isSignUp && (
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            style={{ padding: '10px', fontSize: '1rem', borderRadius: '5px', border: '1px solid #ccc' }}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '10px', fontSize: '1rem', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '10px', fontSize: '1rem', borderRadius: '5px', border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '10px 20px', fontSize: '1rem', cursor: 'pointer', backgroundColor: '#5A153D', color: 'white', border: 'none', borderRadius: '5px' }}>
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
      </form>

      {/* Display messages or errors */}
      {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
      {message && <p style={{ color: 'green', marginTop: '10px' }}>{message}</p>}

      {/* Toggle between Sign In and Sign Up */}
      <p style={{ marginTop: '20px' }}>
        {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
        <span onClick={() => setIsSignUp(!isSignUp)} style={{ color: '#5A153D', cursor: 'pointer', textDecoration: 'underline' }}>
          {isSignUp ? 'Sign In' : 'Sign Up'}
        </span>
      </p>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
        <hr style={{ flex: 1, borderTop: '1px solid #ccc' }} />
        <span style={{ padding: '0 10px', color: '#888' }}>OR</span>
        <hr style={{ flex: 1, borderTop: '1px solid #ccc' }} />
      </div>

      {/* Google Login Button */}
      <button 
        onClick={handleGoogleLogin} 
        style={{ padding: '10px 20px', fontSize: '1rem', cursor: 'pointer', width: '100%' }}
      >
        Continue with Google
      </button>
    </div>
  );
};

export default AuthPage;