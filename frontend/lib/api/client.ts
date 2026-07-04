import axios from "axios"
import { createClient } from "@/lib/supabase/client"

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
})

api.interceptors.request.use(async (config) => {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

export default api
