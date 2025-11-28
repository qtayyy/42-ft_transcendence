import axios from "axios";

// Configure axios globally to send cookies with all requests
axios.defaults.withCredentials = true;

export default axios;
