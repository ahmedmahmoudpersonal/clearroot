import axios from "axios";
import { client_id, noAuthRoutes, baseURL } from "@/app/constant/main";
import { toast } from "react-toastify";
// import { useTranslations } from 'next-intl';
import { getCookie, deleteCookie } from "cookies-next";
import { useRouter } from "next/navigation";

const useApi = () => {
  const router = useRouter();

  const axiosObject = {
    baseURL,
  };

  const mainInstance = axios.create(axiosObject);
  mainInstance.interceptors.request.use(
    function (config) {
      //* add auth
      if (config.url && !noAuthRoutes.includes(config.url)) {
        const cookieToken = getCookie("auth_token");
        console.log("cookieToken", cookieToken);
        // || (await myCookie('token'))?.value
        if (!config.headers) {
          config.headers = {};
        }
        config.headers.authorization = cookieToken
          ? `Bearer ${cookieToken}`
          : "";
      } else {
        if (!config.headers) {
          config.headers = {};
        }
        config.headers["Client-Id"] = client_id;
      }
      //* end auth
      return config;
    },
    (error) => {
      //if err don't do any thing and i will handel it in my global handel error
      return Promise.reject(error);
    }
  );

  mainInstance.interceptors.response.use(
    (res) => {
      // dispatch(changePreloader(false))
      // res.data?.data?.token?.accessToken &&
      //   localStorage.setItem("token", res.data?.data?.token?.accessToken)
      // const roles = ["", "superAdmin"]
      // if (res.data?.data?.userAccount?.email) {
      //   dispatch(
      //     addUserInfo({
      //       email: res.data?.data?.userAccount?.email,
      //       role: roles[res.data?.data?.userAccount?.userType],
      //     })
      //   )
      // }
      return res;
    },
    async (err) => {
      // dispatch(changePreloader(false))
      if (err?.response?.status == 401) {
        router.push("/login");
        deleteCookie("user");
        deleteCookie("auth_token");
        toast?.error("Session expired. Please login again.", {
          position: "top-center",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }

      // if (err?.response?.data?.metadata) {
      //   //when the Access Token is expired
      //   err.response.data.metadata.errors.map((element) => {
      //     toast.error(element.message, {
      //       position: toast.POSITION.TOP_CENTER,
      //     })
      //   })
      // }
      // handleError(err.response.data);

      if (err?.response?.data?.message && typeof window !== "undefined") {
        toast?.error(err.response.data.message, {
          position: "top-center",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
      console.log(err.response, "err.response.data.message");

      return Promise.reject(err);
    }
  );
  return mainInstance;
};

export default useApi;
