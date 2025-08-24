// src/pages/ClerkSignInPage.js
import { SignIn, SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";
import React from 'react';

const ClerkSignInPage = () => {
  // This hook is the magic. It gets the current user from Clerk.
  const { isSignedIn, user } = useUser();

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', paddingTop: '50px' }}>
      
      <SignedIn>
        {/* --- THIS IS WHAT YOU SEE WHEN YOU ARE SIGNED IN --- */}
        <div style={{ textAlign: 'center', padding: '2rem', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h2 style={{ color: 'green' }}>✅ Clerk is Working!</h2>
          <p>You are signed in. Your user information is:</p>
          <p><strong>Email:</strong> {user?.primaryEmailAddress.emailAddress}</p>
          <div style={{ marginTop: '20px' }}>
            <UserButton />
          </div>
        </div>
      </SignedIn>

      <SignedOut>
        {/* --- THIS IS WHAT YOU SEE WHEN YOU ARE SIGNED OUT --- */}
        <SignIn path="/clerk-signin" routing="path" signUpUrl="/clerk-signup" />
      </SignedOut>

    </div>
  );
};

export default ClerkSignInPage;