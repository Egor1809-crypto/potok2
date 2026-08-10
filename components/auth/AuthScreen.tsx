"use client";

import { ArrowRight, Check, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BRAND_NAME } from "@/config/brand";

export function AuthScreen({ mode }: { mode: "login" | "register" }) {
  const [showPassword, setShowPassword] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const register = mode === "register";

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_.95fr]">
      <section className="flex min-h-screen flex-col px-6 py-6 sm:px-10 lg:px-14">
        <Link href="/" className="flex w-fit items-center gap-2.5"><span className="grid size-8 place-items-center rounded-[9px] bg-[#625cf6] text-[13px] font-semibold text-white">M</span><span className="text-[14px] font-semibold tracking-[.12em]">{BRAND_NAME}</span></Link>
        <div className="mx-auto my-auto w-full max-w-[410px] py-14">
          <p className="section-eyebrow">{register ? "Create your workspace" : "Welcome back"}</p>
          <h1 className="mt-3 text-[34px] font-medium tracking-[-.04em] text-[#1c1d28]">{register ? "Start reaching the right people." : `Sign in to ${BRAND_NAME}.`}</h1>
          <p className="mt-3 text-sm leading-6 text-[#777986]">{register ? "Build your contact database and launch your first campaign in minutes." : "Continue to your Legal Team workspace."}</p>
          <Link href="/dashboard" className="mt-8 flex h-11 w-full items-center justify-center gap-3 rounded-[9px] border border-[#dadbe3] bg-white text-sm font-medium text-[#3f414d] shadow-sm transition-colors hover:bg-[#fafafb]"><span className="grid size-5 place-items-center rounded-full bg-white text-sm font-bold text-[#4285f4]">G</span>Continue with Google</Link>
          <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[.1em] text-[#aaa] before:h-px before:flex-1 before:bg-[#e7e7ec] after:h-px after:flex-1 after:bg-[#e7e7ec]">or</div>
          <form onSubmit={(event) => { event.preventDefault(); window.location.assign("/dashboard"); }} className="space-y-4">
            {register && <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#4d4f5c]">Full name</span><input className="input h-11 w-full" name="name" autoComplete="name" placeholder="Egor S." required /></label>}
            <label className="block"><span className="mb-1.5 block text-xs font-medium text-[#4d4f5c]">Work email</span><input className="input h-11 w-full" name="email" type="email" autoComplete="email" placeholder="egor@company.com" required /></label>
            <label className="block"><span className="mb-1.5 flex items-center justify-between text-xs font-medium text-[#4d4f5c]">Password {!register && <button type="button" onClick={() => setResetRequested(true)} className="font-medium text-[#625cf6]">Forgot password?</button>}</span><span className="relative block"><input className="input h-11 w-full pr-11" name="password" type={showPassword ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} placeholder={register ? "At least 8 characters" : "Enter your password"} minLength={8} required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9698a5]">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>{resetRequested && <span className="mt-2 block text-[10px] font-medium text-[#3e8d5c]">Demo reset link sent to your work email.</span>}</label>
            {register && <label className="flex items-start gap-2.5 text-[11px] leading-5 text-[#777986]"><input type="checkbox" required className="mt-1 accent-[#625cf6]" />I agree to the Terms of Service and Privacy Policy.</label>}
            <button type="submit" className="btn btn-primary min-h-11 w-full justify-center gap-2">{register ? "Create workspace" : "Sign in"}<ArrowRight size={15} /></button>
          </form>
          <p className="mt-7 text-center text-xs text-[#777986]">{register ? "Already have an account?" : `New to ${BRAND_NAME}?`} <Link className="font-semibold text-[#5e58da]" href={register ? "/login" : "/register"}>{register ? "Sign in" : "Create an account"}</Link></p>
        </div>
      </section>
      <aside className="relative hidden overflow-hidden bg-[#20212c] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 size-[430px] rounded-full bg-[#675ff1]/25 blur-3xl" /><div className="absolute -bottom-40 -left-20 size-[400px] rounded-full bg-[#35a3d4]/15 blur-3xl" />
        <div className="relative ml-auto rounded-full border border-white/10 bg-white/[.06] px-3 py-1.5 text-[10px] text-white/70">Demo workspace · No card required</div>
        <div className="relative max-w-[540px]"><p className="text-[12px] font-semibold uppercase tracking-[.16em] text-[#aaa6ff]">One connected workspace</p><h2 className="mt-5 text-[46px] font-medium leading-[1.03] tracking-[-.05em]">From your contact list to a meaningful reply.</h2><p className="mt-6 max-w-md text-[15px] leading-7 text-white/60">Organize relationships, shape precise audiences and build emails people want to open.</p><div className="mt-10 grid grid-cols-2 gap-3">{["24,821 contacts ready","98.2% delivery rate","Live personalization","Clear campaign analytics"].map(item=><div key={item} className="flex items-center gap-2 rounded-xl border border-white/[.08] bg-white/[.045] p-3 text-[11px] text-white/75"><span className="grid size-5 place-items-center rounded-full bg-[#716afa]/20 text-[#aaa6ff]"><Check size={11} /></span>{item}</div>)}</div></div>
        <div className="relative text-[10px] text-white/35">Trusted by focused legal, events and B2B teams.</div>
      </aside>
    </main>
  );
}
