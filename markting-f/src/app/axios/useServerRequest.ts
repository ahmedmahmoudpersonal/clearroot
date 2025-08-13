import createServerApi from "./useServerApi";

const getServerRequest = async () => {
  const Request = await createServerApi();

  //   const getDoctorSetting = async (id: String) => {
  //     return await Request.get(`doctors/setting/${id}`);
  //   };

  const getProducts = async (query: string) => {
    return await Request.get(`products/${query}`);
  };

  const favoriteProductDetails = async (page = 1, limit = 10) => {
    return await Request.get(
      `favorites/my-favorites?page=${page}&limit=${limit}`
    );
  };
  const getStoreByName = async (name: string) => {
    // Add store name validation before calling the API
    if (!name || typeof name !== "string" || name.trim() === "") {
      throw new Error("Invalid store name provided");
    }

    try {
      return await Request.get(`stores/storeName/${name.trim()}`);
    } catch (error: unknown) {
      // Log the error for debugging but don't crash the app
      const errorMsg = (error as Error)?.message || "Unknown error";
      console.error(`Failed to fetch store ${name}:`, errorMsg);
      throw error; // Re-throw so the caller can handle it
    }
  };

  return {
    getProducts,
    favoriteProductDetails,
    getStoreByName,
  };
};
export default getServerRequest;
