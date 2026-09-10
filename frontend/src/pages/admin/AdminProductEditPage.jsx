import { Navigate, useParams } from 'react-router-dom';

export default function AdminProductEditPage() {
  const { id } = useParams();
  return <Navigate to={`/admin/products/${id}?tab=product`} replace />;
}
