import { useRouter, useSearchParams } from "next/navigation";

// Define the type for the queries object
type Queries = Record<string, string | number | boolean | null | undefined>;

const useUrlQuery = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const addQueries = (queries: Queries) => {
    console.log("new query", queries);

    // Create a new URLSearchParams object from the current search params
    const params = new URLSearchParams(searchParams?.toString() || "");

    // Loop through the queries object and add/update each key-value pair
    Object.entries(queries).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        params.set(key, String(value)); // Add or update the query parameter
      } else {
        params.delete(key); // Remove the query parameter if the value is falsy
      }
    });

    // Update the URL with the new query parameters
    router.push(`?${params.toString()}`);
  };

  return { addQueries };
};

export default useUrlQuery;
