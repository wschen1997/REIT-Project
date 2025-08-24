import { SignUp } from "@clerk/clerk-react";
import React from 'react';

const ClerkSignUpPage = () => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', paddingTop: '80px' }}>
      {/* --- CHANGE START --- */}
      {/* We've added the afterSignUpUrl prop to redirect users to their account page */}
      <SignUp 
        path="/clerk-signup" 
        routing="path" 
        signInUrl="/clerk-signin" 
        afterSignUpUrl="/user" 
      />
      {/* --- CHANGE END --- */}
    </div>
  );
};

export default ClerkSignUpPage;