import React from 'react';
import { ArrowRight } from 'lucide-react';

const CtaSection: React.FC = () => {
  return (
    <section id="cta" className="py-16 md:py-24 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold">
            Simplify Identity Verification for Your Platform
          </h2>
          <p className="mt-6 text-lg text-blue-100">
            Join businesses that trust our KYC solution to securely verify user identities while maintaining a seamless onboarding experience.
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
            <a 
              href="https://calendly.com/f_o" 
              target='_blank'
              className="px-6 py-3 bg-white text-blue-600 rounded-md font-medium hover:bg-blue-50 transition-colors shadow-sm flex items-center justify-center"
            >
              Schedule a Demo
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
            <a 
              href="https://calendly.com/f_o" 
              target='_blank'
              className="px-6 py-3 border border-white text-white rounded-md font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              Get in Touch
            </a>
          </div>
          
          <p className="mt-8 text-sm text-blue-200">
            No credit card required. Start with a free consultation.
          </p>
        </div>
      </div>
    </section>
  );
};

export default CtaSection;