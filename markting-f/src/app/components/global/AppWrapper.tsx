'use client';
import React from 'react';
// import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// import { NextIntlClientProvider } from 'next-intl';
import { ToastContainer } from 'react-toastify';
// import store from '@/redux/store';
// import { PrimeReactProvider } from 'primereact/api';

function AppWrapper({
  children,
  // pageProps,
}: Readonly<{
  children: React.ReactNode;
  // pageProps: { messages: any; locale: string };
}>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  });

  // const { messages, locale } = pageProps;

  return (
    <QueryClientProvider client={queryClient}>
      {/* <Provider store={store}> */}
      {/* <NextIntlClientProvider
          messages={messages}
          locale={locale}
          timeZone="UTC"
        > */}
      {/* <PrimeReactProvider> */}
      {children}
      {/* </PrimeReactProvider> */}
      {/* </NextIntlClientProvider> */}
      <ToastContainer />
      {/* </Provider> */}
    </QueryClientProvider>
  );
}

export default AppWrapper;
