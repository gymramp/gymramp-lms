
export default function PrivacyPage() {
    return (
      <div className="container mx-auto py-12 md:py-16 lg:py-20">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-primary mb-8 text-center">
          Privacy Policy
        </h1>
        <div className="prose prose-lg max-w-none mx-auto text-muted-foreground">
          <p>
            Your privacy is important to us. It is GYMRAMP's policy to respect your privacy regarding any information we may collect from you across our website, [Your Website URL], and other sites we own and operate. {/* Updated App Name */}
          </p>
           <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Information We Collect</h2>
          <p>
            We only ask for personal information when we truly need it to provide a service to you. We collect it by fair and lawful means, with your knowledge and consent. We also let you know why we’re collecting it and how it will be used.
          </p>
          <p>Information we may collect includes:</p>
          <ul className="list-disc pl-6">
            <li>Name (Manager and Employees)</li>
            <li>Email Address (Manager and Employees)</li>
            <li>Gym Name</li>
            <li>Payment Information (processed securely by a third-party provider)</li>
            <li>Course progress data</li>
            <li>Website usage data (through cookies and analytics)</li>
          </ul>
  
           <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">How We Use Your Information</h2>
           <p>We use the information we collect in various ways, including to:</p>
           <ul className="list-disc pl-6">
              <li>Provide, operate, and maintain our website and services</li>
              <li>Improve, personalize, and expand our website and services</li>
              <li>Understand and analyze how you use our website</li>
              <li>Develop new products, services, features, and functionality</li>
              <li>Communicate with you, either directly or through one of our partners, including for customer service, to provide you with updates and other information relating to the website, and for marketing and promotional purposes</li>
              <li>Process your transactions</li>
              <li>Track employee course progress for managers</li>
              <li>Issue completion certificates</li>
              <li>Find and prevent fraud</li>
           </ul>
  
           <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Data Security</h2>
          <p>
             We take reasonable precautions to protect your information. When you submit sensitive information via the website, your information is protected both online and offline. Wherever we collect sensitive information (such as credit card data), that information is encrypted and transmitted to us in a secure way.
          </p>
           <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Sharing Your Information</h2>
          <p>
              We do not share your personally identifying information publicly or with third-parties, except when required to by law or as necessary to provide our services (e.g., payment processing). Employee progress data is shared only with the designated manager account associated with the gym.
          </p>
           <h2 className="text-xl font-semibold text-foreground mt-6 mb-3">Your Data Rights</h2>
          <p>
              You have the right to access, update, or delete the personal information we have on you. If you wish to exercise these rights, please contact us.
          </p>
           <p className="mt-6">
              [Placeholder: Add details about cookie policy, third-party links, children's privacy, policy updates, etc.]
           </p>
  
          <p className="mt-6">
            This policy is effective as of {new Date().toLocaleDateString()}.
          </p>
        </div>
      </div>
    );
  }
  