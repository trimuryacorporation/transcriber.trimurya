import React from 'react';
import { Link } from 'react-router-dom';
export function ErrorPage({ code, title }) { return <main className="grid min-h-screen place-items-center"><div className="text-center"><p className="text-7xl font-bold text-primary">{code}</p><h1 className="mt-2 text-2xl font-semibold">{title}</h1><Link className="btn-accent mt-5" to="/">Go home</Link></div></main>; }
