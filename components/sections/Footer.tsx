import React from 'react';
import { Shield, Mail, Phone, MapPin } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="md:col-span-1">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-500" />
              <span className="ml-2 text-xl font-bold text-white">KYCVerify</span>
            </div>
            <p className="mt-4 text-sm">
              Secure, compliant identity verification for modern businesses
            </p>
            <div className="mt-6 flex space-x-4">
              <a href="https://x.com/valtara_ai" target='_blank' className="text-slate-400 hover:text-blue-500">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="https://www.linkedin.com/company/valtara-ai/" target='_blank' className="text-slate-400 hover:text-blue-500">
                <span className="sr-only">LinkedIn</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
            </div>
          </div>
          
          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              Product
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <a href="#features" className="text-sm hover:text-blue-500">Features</a>
              </li>
              <li>
                <a href="#how-it-works" className="text-sm hover:text-blue-500">How It Works</a>
              </li>
              
             
            </ul>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              Company
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <a href="https://valtara.ai" target='_blank' className="text-sm hover:text-blue-500">About Us</a>
              </li>
             
              <li>
                <a href="https://blog.valtara.ai" target='_blank' className="text-sm hover:text-blue-500">Blog</a>
              </li>
              
            </ul>
          </div>
          
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              Contact
            </h3>
            <ul className="mt-4 space-y-3">
              <li className="flex items-start">
                <Mail className="h-5 w-5 text-blue-500 mr-2" />
                <span className="text-sm">info@valtara.ai</span>
              </li>
              <li className="flex items-start">
                <Phone className="h-5 w-5 text-blue-500 mr-2" />
                <span className="text-sm">+1 (306) 9000 830 </span>
              </li>
              <li className="flex items-start">
                <MapPin className="h-5 w-5 text-blue-500 mr-2" />
                <span className="text-sm">118 Shillington Crescent, Saskatoon,SK S7M 3Z9</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-slate-700 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm">
            &copy; {new Date().getFullYear()} KYCVerify. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0 flex space-x-6">
            <a href="https://legal.valtara.ai/privacy-policy" target='_blank' className="text-sm hover:text-blue-500">Privacy Policy</a>
            <a href="https://legal.valtara.ai/terms-of-service" target='_blank' className="text-sm hover:text-blue-500">Terms of Service</a>
            <a href="https://legal.valtara.ai/cookies-policy" target='_blank' className="text-sm hover:text-blue-500">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;