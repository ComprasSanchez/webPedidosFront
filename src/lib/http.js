// src/lib/http.js  (nuevo)
import axios from "axios";
import { API_URL } from "../config/api";

export const http = axios.create({
    baseURL: API_URL,
    headers: { "Cache-Control": "no-cache" }, // evita 304 del navegador/CDN
    withCredentials: false,
});
