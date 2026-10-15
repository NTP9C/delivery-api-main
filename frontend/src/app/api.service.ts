import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Customer {
  customer_id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  lat: number;
  lng: number;
  address_note: string | null;
}

export interface Order {
  order_id: number;
  customer_id: number;
  order_date: string;
  box_count: number;
  deadline: string;
  status: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  lat: number;
  lng: number;
  address_note: string | null;
}

export interface CustomerPayload {
  first_name: string;
  last_name: string;
  phone: string | null;
  lat: number;
  lng: number;
  address_note: string | null;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  getCustomers(): Observable<Customer[]> {
    return this.http.get<Customer[]>('/customers');
  }

  createCustomer(payload: CustomerPayload): Observable<Customer> {
    return this.http.post<Customer>('/customers', payload);
  }

  updateCustomer(id: number, payload: CustomerPayload): Observable<Customer> {
    return this.http.put<Customer>(`/customers/${id}`, payload);
  }

  deleteCustomer(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/customers/${id}`);
  }

  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>('/orders');
  }

  createOrder(payload: { customer_id: number; box_count: number }): Observable<Order> {
    return this.http.post<Order>('/orders', payload);
  }

  updateOrder(id: number, box_count: number): Observable<Order> {
    return this.http.put<Order>(`/orders/${id}`, { box_count });
  }

  deleteOrder(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`/orders/${id}`);
  }

  simulateOrders(count: number): Observable<{ count: number; orders: Order[] }> {
    return this.http.post<{ count: number; orders: Order[] }>('/orders/simulate', { count });
  }

  clearOrders(): Observable<{ message: string; deleted: number }> {
    return this.http.delete<{ message: string; deleted: number }>('/orders');
  }
}
