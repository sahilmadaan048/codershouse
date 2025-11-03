import { useState, useEffect } from 'react';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { setAuth } from '../store/authSlice';

export function useLoadingWithRefresh() {
    const [loading, setLoading] = useState(true);
    const dispatch = useDispatch();
    useEffect(() => {
        (async () => {
            console.log("i am in line 11 of useLoading")
            try {
                console.log("i am in line 13 of useLoading")
                const { data } = await axios.get(
                    `${process.env.REACT_APP_API_URL}/api/refresh`,
                    {
                        withCredentials: true,
                    }
                );
                console.log("i am in line 20 of useLoading")
                dispatch(setAuth(data));
                setLoading(false);
            } catch (err) {
                console.log(err);
                setLoading(false);
            }
        })();
    }, []);

    return { loading };
}