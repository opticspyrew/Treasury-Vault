import { useState } from "react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/dashboard-layout";

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda",
  "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain",
  "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
  "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria",
  "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada",
  "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros",
  "Congo (Brazzaville)", "Congo (Kinshasa)", "Costa Rica", "Croatia", "Cuba", "Cyprus",
  "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador",
  "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini",
  "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany",
  "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
  "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya",
  "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho",
  "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi",
  "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius",
  "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco",
  "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand",
  "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman",
  "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru",
  "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa",
  "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia",
  "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
  "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka",
  "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan",
  "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago",
  "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine",
  "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

const CURRENCIES = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "INR", name: "Indian Rupee" },
  { code: "KRW", name: "South Korean Won" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "ZAR", name: "South African Rand" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "AED", name: "UAE Dirham" },
  { code: "ARS", name: "Argentine Peso" },
  { code: "COP", name: "Colombian Peso" },
  { code: "CLP", name: "Chilean Peso" },
  { code: "PEN", name: "Peruvian Sol" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "RON", name: "Romanian Leu" },
  { code: "ILS", name: "Israeli Shekel" },
  { code: "THB", name: "Thai Baht" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "UAH", name: "Ukrainian Hryvnia" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "OMR", name: "Omani Rial" },
  { code: "JOD", name: "Jordanian Dinar" },
  { code: "MAD", name: "Moroccan Dirham" },
  { code: "TZS", name: "Tanzanian Shilling" },
  { code: "XOF", name: "West African CFA Franc" },
  { code: "XAF", name: "Central African CFA Franc" },
  { code: "TWD", name: "New Taiwan Dollar" },
  { code: "CNH", name: "Offshore Chinese Yuan" },
  { code: "HRK", name: "Croatian Kuna" },
  { code: "BGN", name: "Bulgarian Lev" },
  { code: "ISK", name: "Icelandic Krona" },
  { code: "LKR", name: "Sri Lankan Rupee" },
  { code: "MMK", name: "Myanmar Kyat" },
  { code: "NPR", name: "Nepalese Rupee" },
  { code: "MUR", name: "Mauritian Rupee" },
  { code: "UGX", name: "Ugandan Shilling" },
  { code: "ZMW", name: "Zambian Kwacha" },
  { code: "ETB", name: "Ethiopian Birr" },
  { code: "DZD", name: "Algerian Dinar" },
  { code: "IQD", name: "Iraqi Dinar" },
  { code: "LBP", name: "Lebanese Pound" },
  { code: "SDG", name: "Sudanese Pound" },
  { code: "BYN", name: "Belarusian Ruble" },
  { code: "AMD", name: "Armenian Dram" },
  { code: "AZN", name: "Azerbaijani Manat" },
  { code: "GEL", name: "Georgian Lari" },
  { code: "KZT", name: "Kazakhstani Tenge" },
  { code: "UZS", name: "Uzbekistani Som" },
];

const BANKS_BY_COUNTRY: Record<string, string[]> = {
  "United States": ["JPMorgan Chase", "Bank of America", "Wells Fargo", "Citibank", "US Bank", "Truist Bank", "PNC Bank", "Goldman Sachs", "Morgan Stanley", "Capital One", "TD Bank", "HSBC USA", "Other"],
  "United Kingdom": ["HSBC UK", "Barclays", "Lloyds Bank", "NatWest", "Santander UK", "Nationwide", "Standard Chartered", "Metro Bank", "Starling Bank", "Monzo", "Other"],
  "Germany": ["Deutsche Bank", "Commerzbank", "DZ Bank", "KfW", "ING Germany", "HypoVereinsbank", "Postbank", "Sparkasse", "N26", "Other"],
  "France": ["BNP Paribas", "Crédit Agricole", "Société Générale", "Groupe BPCE", "Crédit Mutuel", "La Banque Postale", "Boursorama", "Other"],
  "China": ["Industrial and Commercial Bank of China", "China Construction Bank", "Agricultural Bank of China", "Bank of China", "Bank of Communications", "WeBank", "Other"],
  "Japan": ["Mitsubishi UFJ", "Sumitomo Mitsui", "Mizuho Bank", "Japan Post Bank", "Resona Bank", "Other"],
  "India": ["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra", "Yes Bank", "Bank of Baroda", "Punjab National Bank", "Other"],
  "Australia": ["Commonwealth Bank", "Westpac", "ANZ", "NAB", "Macquarie Bank", "Other"],
  "Canada": ["Royal Bank of Canada", "TD Canada", "Scotiabank", "BMO", "CIBC", "National Bank", "Other"],
  "Singapore": ["DBS Bank", "OCBC Bank", "UOB", "Standard Chartered SG", "Citibank Singapore", "Other"],
  "UAE": ["Emirates NBD", "First Abu Dhabi Bank", "ADCB", "Dubai Islamic Bank", "Mashreq Bank", "Other"],
};

type SubTab = "bank" | "card";

interface BankForm {
  country: string;
  currency: string;
  bankName: string;
  customBank: string;
  accountHolder: string;
  accountNumber: string;
  routingCode: string;
  swiftBic: string;
  iban: string;
  amount: string;
}

interface CardForm {
  cardHolder: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
  billingCountry: string;
  billingCurrency: string;
  billingAmount: string;
}

export default function LinkAccount() {
  const [, navigate] = useLocation();
  const [subTab, setSubTab] = useState<SubTab>("bank");
  const [step, setStep] = useState<"form" | "success">("form");
  const [loading, setLoading] = useState(false);

  const [bankForm, setBankForm] = useState<BankForm>({
    country: "United States",
    currency: "USD",
    bankName: "",
    customBank: "",
    accountHolder: "",
    accountNumber: "",
    routingCode: "",
    swiftBic: "",
    iban: "",
    amount: "",
  });

  const [cardForm, setCardForm] = useState<CardForm>({
    cardHolder: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    billingCountry: "United States",
    billingCurrency: "USD",
    billingAmount: "",
  });

  const [bankSearch, setBankSearch] = useState("");

  const availableBanks = BANKS_BY_COUNTRY[bankForm.country] || ["Local Bank", "National Bank", "Regional Bank", "International Bank", "Other"];
  const filteredBanks = availableBanks.filter(b => b.toLowerCase().includes(bankSearch.toLowerCase()));

  const formatCardNumber = (v: string) =>
    v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");

  const formatExpiry = (v: string) =>
    v.replace(/\D/g, "").slice(0, 4).replace(/(\d{2})(\d)/, "$1/$2");

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1800));
    setLoading(false);
    setStep("success");
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1800));
    setLoading(false);
    setStep("success");
  };

  if (step === "success") {
    return (
      <DashboardLayout activeTab="link-account">
        <div className="max-w-lg mx-auto mt-12 text-center">
          <div className="bg-card border border-card-border rounded-2xl p-10">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {subTab === "bank" ? "Bank Account Linked!" : "Card Linked Successfully!"}
            </h2>
            <p className="text-muted-foreground text-sm mb-3">
              {subTab === "bank"
                ? `Your ${bankForm.bankName || bankForm.customBank || "bank"} account has been linked. Funds will be processed within 1–3 business days.`
                : `Your card ending in ${cardForm.cardNumber.replace(/\s/g, "").slice(-4)} has been linked.`}
            </p>
            {subTab === "bank" && (
              <div className="bg-muted rounded-xl p-4 text-left space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Country</span>
                  <span className="text-foreground font-medium">{bankForm.country}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Currency</span>
                  <span className="text-foreground font-medium">{bankForm.currency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Account Holder</span>
                  <span className="text-foreground font-medium">{bankForm.accountHolder}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <span className="text-primary font-medium">Verified</span>
                </div>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { setStep("form"); setBankForm({ country: "United States", currency: "USD", bankName: "", customBank: "", accountHolder: "", accountNumber: "", routingCode: "", swiftBic: "", iban: "", amount: "" }); setCardForm({ cardHolder: "", cardNumber: "", expiry: "", cvv: "", billingCountry: "United States", billingCurrency: "USD", billingAmount: "" }); }}
                className="px-5 py-2.5 bg-muted border border-border rounded-xl text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Link Another
              </button>
              <button
                onClick={() => navigate("/invoice")}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                View Invoice
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activeTab="link-account">
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Link Payment Account</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Connect your bank account or card to process payments. All countries and currencies supported.
          </p>
        </div>

        {/* Sub-tab toggle */}
        <div className="flex bg-muted rounded-xl p-1 gap-1 max-w-xs">
          <button
            onClick={() => setSubTab("bank")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${subTab === "bank" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Bank Account
          </button>
          <button
            onClick={() => setSubTab("card")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${subTab === "card" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Debit / Credit Card
          </button>
        </div>

        {/* Bank Account Form */}
        {subTab === "bank" && (
          <div className="bg-card border border-card-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Bank Account Details</h3>
                <p className="text-xs text-muted-foreground">Supports all banks worldwide — SWIFT, IBAN, ACH, SEPA, and more</p>
              </div>
            </div>

            <form onSubmit={handleBankSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Country */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Country <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={bankForm.country}
                    onChange={e => { setBankForm(f => ({ ...f, country: e.target.value, bankName: "", customBank: "" })); setBankSearch(""); }}
                    className="w-full px-3 py-2.5 bg-muted border border-input rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Currency */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Account Currency <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={bankForm.currency}
                    onChange={e => setBankForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-input rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Bank search */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Bank Name <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={bankSearch}
                    onChange={e => { setBankSearch(e.target.value); setBankForm(f => ({ ...f, bankName: "", customBank: e.target.value })); }}
                    placeholder={`Search banks in ${bankForm.country}...`}
                    className="w-full pl-9 pr-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                {bankSearch && filteredBanks.length > 0 && (
                  <div className="mt-1 bg-card border border-card-border rounded-xl overflow-hidden shadow-lg max-h-40 overflow-y-auto">
                    {filteredBanks.map(bank => (
                      <button
                        key={bank}
                        type="button"
                        onClick={() => { setBankForm(f => ({ ...f, bankName: bank, customBank: bank })); setBankSearch(bank); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        {bank}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Account holder */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Account Holder Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={bankForm.accountHolder}
                  onChange={e => setBankForm(f => ({ ...f, accountHolder: e.target.value }))}
                  placeholder="Full legal name as on account"
                  className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Account / IBAN */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Account Number / IBAN <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={bankForm.accountNumber}
                    onChange={e => setBankForm(f => ({ ...f, accountNumber: e.target.value }))}
                    placeholder="e.g. GB29 NWBK 6016 1331 9268 19"
                    className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                {/* Routing / Sort code */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Routing / Sort Code
                  </label>
                  <input
                    type="text"
                    value={bankForm.routingCode}
                    onChange={e => setBankForm(f => ({ ...f, routingCode: e.target.value }))}
                    placeholder="ABA routing / sort code"
                    className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* SWIFT/BIC */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">SWIFT / BIC Code</label>
                <input
                  type="text"
                  value={bankForm.swiftBic}
                  onChange={e => setBankForm(f => ({ ...f, swiftBic: e.target.value.toUpperCase() }))}
                  placeholder="e.g. BOFAUS3N"
                  className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  maxLength={11}
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Amount to Transfer <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={bankForm.amount}
                    onChange={e => setBankForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-20"
                    required
                    min="0"
                    step="any"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">{bankForm.currency}</span>
                </div>
              </div>

              {/* Info box */}
              <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/15 rounded-xl">
                <svg className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-muted-foreground">
                  We support bank transfers in <strong className="text-foreground">190+ countries</strong> and{" "}
                  <strong className="text-foreground">{CURRENCIES.length}+ currencies</strong>. Your account details are encrypted with AES-256 and never stored in plaintext.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verifying & Linking...
                  </>
                ) : "Link Bank Account"}
              </button>
            </form>
          </div>
        )}

        {/* Card Form */}
        {subTab === "card" && (
          <div className="bg-card border border-card-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Card Details</h3>
                <p className="text-xs text-muted-foreground">Visa, Mastercard, AMEX, Discover, UnionPay, Maestro — all currencies</p>
              </div>
            </div>

            {/* Card preview */}
            <div className="relative w-full h-40 bg-gradient-to-br from-blue-700 to-indigo-900 rounded-2xl p-5 mb-6 overflow-hidden select-none">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white rounded-full -translate-y-1/2 translate-x-1/4" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full translate-y-1/2 -translate-x-1/4" />
              </div>
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div className="flex items-center justify-between">
                  <div className="w-8 h-6 bg-amber-400 rounded-sm opacity-90" />
                  <span className="text-white text-xs font-semibold opacity-60">CryptoVault</span>
                </div>
                <div>
                  <p className="text-white font-mono text-base tracking-widest">
                    {cardForm.cardNumber || "•••• •••• •••• ••••"}
                  </p>
                  <div className="flex justify-between mt-2">
                    <div>
                      <p className="text-white/50 text-xs">Card Holder</p>
                      <p className="text-white text-sm font-semibold uppercase tracking-wide">
                        {cardForm.cardHolder || "FULL NAME"}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs">Expires</p>
                      <p className="text-white text-sm font-semibold">{cardForm.expiry || "MM/YY"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleCardSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Cardholder Name <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={cardForm.cardHolder}
                  onChange={e => setCardForm(f => ({ ...f, cardHolder: e.target.value.toUpperCase() }))}
                  placeholder="As printed on card"
                  className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Card Number <span className="text-destructive">*</span></label>
                <input
                  type="text"
                  value={cardForm.cardNumber}
                  onChange={e => setCardForm(f => ({ ...f, cardNumber: formatCardNumber(e.target.value) }))}
                  placeholder="•••• •••• •••• ••••"
                  className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  maxLength={19}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Expiry Date <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    value={cardForm.expiry}
                    onChange={e => setCardForm(f => ({ ...f, expiry: formatExpiry(e.target.value) }))}
                    placeholder="MM/YY"
                    className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    maxLength={5}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">CVV / CVC <span className="text-destructive">*</span></label>
                  <input
                    type="password"
                    value={cardForm.cvv}
                    onChange={e => setCardForm(f => ({ ...f, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    placeholder="•••"
                    className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    maxLength={4}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Billing Country <span className="text-destructive">*</span></label>
                  <select
                    value={cardForm.billingCountry}
                    onChange={e => setCardForm(f => ({ ...f, billingCountry: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-input rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">Billing Currency <span className="text-destructive">*</span></label>
                  <select
                    value={cardForm.billingCurrency}
                    onChange={e => setCardForm(f => ({ ...f, billingCurrency: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-muted border border-input rounded-xl text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">Payment Amount <span className="text-destructive">*</span></label>
                <div className="relative">
                  <input
                    type="number"
                    value={cardForm.billingAmount}
                    onChange={e => setCardForm(f => ({ ...f, billingAmount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-4 py-2.5 bg-muted border border-input rounded-xl text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-20"
                    required
                    min="0"
                    step="any"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">{cardForm.billingCurrency}</span>
                </div>
              </div>

              {/* Accepted card brands */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground">Accepted:</span>
                {["VISA", "MC", "AMEX", "DISC", "UP", "MAE"].map(brand => (
                  <span key={brand} className="px-2.5 py-1 bg-muted border border-border rounded-lg text-xs font-bold text-foreground">
                    {brand}
                  </span>
                ))}
              </div>

              {/* Security note */}
              <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/15 rounded-xl">
                <svg className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-xs text-muted-foreground">
                  Your card is secured with <strong className="text-foreground">PCI-DSS Level 1</strong> compliance, 3D Secure authentication, and end-to-end encryption.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </>
                ) : "Link Card & Pay"}
              </button>
            </form>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Your financial data is encrypted and protected under our Privacy Policy and applicable data protection laws.
        </p>
      </div>
    </DashboardLayout>
  );
}
