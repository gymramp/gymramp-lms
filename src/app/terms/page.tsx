
export default function TermsPage() {
    return (
      <div className="container mx-auto py-12 md:py-16 lg:py-20">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-primary mb-8 text-center">
          Terms of Service
        </h1>
        <div className="prose prose-lg max-w-none mx-auto text-muted-foreground">
          <p>
            Welcome to GYMRAMP! These terms and conditions outline the rules and regulations for the use of GYMRAMP's Website, located at [Your Website URL]. {/* Updated App Name */}
          </p>
          <p>
            By accessing this website we assume you accept these terms and conditions. Do not continue to use GYMRAMP if you do not agree to take all of the terms and conditions stated on this page. {/* Updated App Name */}
          </p>
          <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Cookies</h2>
          <p>
            We employ the use of cookies. By accessing GYMRAMP, you agreed to use cookies in agreement with the GYMRAMP's Privacy Policy. {/* Updated App Name */}
          </p>
          <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">License</h2>
          <p>
            Unless otherwise stated, GYMRAMP and/or its licensors own the intellectual property rights for all material on GYMRAMP. All intellectual property rights are reserved. You may access this from GYMRAMP for your own personal use subjected to restrictions set in these terms and conditions. {/* Updated App Name */}
          </p>
          <p>You must not:</p>
          <ul className="list-disc pl-6">
            <li>Republish material from GYMRAMP</li> {/* Updated App Name */}
            <li>Sell, rent or sub-license material from GYMRAMP</li> {/* Updated App Name */}
            <li>Reproduce, duplicate or copy material from GYMRAMP</li> {/* Updated App Name */}
            <li>Redistribute content from GYMRAMP</li> {/* Updated App Name */}
          </ul>
          <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">User Accounts</h2>
          <p>
            You are responsible for maintaining the security of your account and password. GYMRAMP cannot and will not be liable for any loss or damage from your failure to comply with this security obligation. {/* Updated App Name */}
          </p>
          <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Course Content</h2>
          <p>
             The course materials provided are for educational purposes only and are licensed to the purchasing entity for use by their designated employees. Unauthorized sharing or reproduction is strictly prohibited.
          </p>
           <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Termination</h2>
          <p>
            We may terminate or suspend access to our Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
          </p>
          <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Disclaimer</h2>
          <p>
             The materials on GYMRAMP's website are provided on an 'as is' basis. GYMRAMP makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights. {/* Updated App Name */}
          </p>
           <p className="mt-6">
              [Placeholder: Add more specific terms related to payments, refunds, user conduct, limitations of liability, governing law, etc.]
           </p>
          <p className="mt-6">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    );
  }
  