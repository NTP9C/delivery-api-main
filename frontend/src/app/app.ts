import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService, Customer, Order } from './api.service';

type Page = 'overview' | 'orders' | 'customers';

@Component({
  imports: [CommonModule, FormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App implements OnInit {
  private readonly api = inject(ApiService);

  protected readonly page = signal<Page>('overview');
  protected readonly customers = signal<Customer[]>([]);
  protected readonly orders = signal<Order[]>([]);
  protected readonly loading = signal(true);
  protected readonly dataLoaded = signal(false);
  protected readonly apiConnected = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly query = signal('');
  protected readonly customerModalOpen = signal(false);
  protected readonly orderModalOpen = signal(false);
  protected readonly editingCustomerId = signal<number | null>(null);
  protected readonly editingOrderId = signal<number | null>(null);
  protected readonly customerForm = signal(this.emptyCustomerForm());
  protected readonly orderForm = signal({ customer_id: 0, box_count: 1 });

  ngOnInit(): void {
    this.loadData();
  }

  protected get filteredCustomers(): Customer[] {
    const term = this.query().trim().toLocaleLowerCase();
    if (!term) return this.customers();
    return this.customers().filter((customer) =>
      [customer.first_name, customer.last_name, customer.phone ?? '', customer.address_note ?? '']
        .join(' ')
        .toLocaleLowerCase()
        .includes(term),
    );
  }

  protected get filteredOrders(): Order[] {
    const term = this.query().trim().toLocaleLowerCase();
    if (!term) return this.orders();
    return this.orders().filter((order) =>
      [order.order_id, order.first_name, order.last_name, order.phone ?? '', order.status]
        .join(' ')
        .toLocaleLowerCase()
        .includes(term),
    );
  }

  protected get todayOrders(): number {
    const today = new Date().toDateString();
    return this.orders().filter((order) => new Date(order.order_date).toDateString() === today)
      .length;
  }

  protected get pendingOrders(): number {
    return this.orders().filter((order) => order.status === 'pending').length;
  }

  protected get totalBoxes(): number {
    return this.orders().reduce((total, order) => total + order.box_count, 0);
  }

  protected get today(): string {
    return new Date().toISOString();
  }

  protected customerOrderCount(customerId: number): number {
    return this.orders().filter((order) => order.customer_id === customerId).length;
  }

  protected loadData(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      customers: this.api.getCustomers(),
      orders: this.api.getOrders(),
    }).subscribe({
      next: ({ customers, orders }) => {
        this.customers.set(customers);
        this.orders.set(orders);
        this.dataLoaded.set(true);
        this.apiConnected.set(true);
        if (this.orderForm().customer_id === 0 && customers.length > 0) {
          this.orderForm.update((form) => ({
            ...form,
            customer_id: customers[0].customer_id,
          }));
        }
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.showError(error, 'โหลดข้อมูลไม่สำเร็จ');
      },
    });
  }

  protected setPage(page: Page): void {
    this.page.set(page);
    this.query.set('');
    this.notice.set('');
    this.error.set('');
  }

  protected openNewCustomer(): void {
    this.error.set('');
    this.editingCustomerId.set(null);
    this.customerForm.set(this.emptyCustomerForm());
    this.customerModalOpen.set(true);
  }

  protected editCustomer(customer: Customer): void {
    this.error.set('');
    this.editingCustomerId.set(customer.customer_id);
    this.customerForm.set({
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone ?? '',
      lat: customer.lat,
      lng: customer.lng,
      address_note: customer.address_note ?? '',
    });
    this.customerModalOpen.set(true);
  }

  protected saveCustomer(): void {
    const form = this.customerForm();
    if (
      !form.first_name.trim() ||
      !form.last_name.trim() ||
      !Number.isFinite(Number(form.lat)) ||
      !Number.isFinite(Number(form.lng)) ||
      Number(form.lat) < -90 ||
      Number(form.lat) > 90 ||
      Number(form.lng) < -180 ||
      Number(form.lng) > 180
    ) {
      this.error.set(
        'กรุณากรอกชื่อ นามสกุล และพิกัดให้ถูกต้อง (ละติจูด -90 ถึง 90, ลองจิจูด -180 ถึง 180)',
      );
      return;
    }

    const payload = {
      ...form,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone.trim() || null,
      lat: Number(form.lat),
      lng: Number(form.lng),
      address_note: form.address_note.trim() || null,
    };
    const customerId = this.editingCustomerId();
    this.saving.set(true);
    this.error.set('');
    const request = customerId
      ? this.api.updateCustomer(customerId, payload)
      : this.api.createCustomer(payload);

    request.subscribe({
      next: (customer) => {
        this.apiConnected.set(true);
        this.customers.update((items) =>
          customerId
            ? items.map((item) => (item.customer_id === customer.customer_id ? customer : item))
            : [customer, ...items],
        );
        this.customerModalOpen.set(false);
        this.saving.set(false);
        this.notice.set(customerId ? 'บันทึกการแก้ไขลูกค้าแล้ว' : 'เพิ่มลูกค้าแล้ว');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.showError(error, 'บันทึกข้อมูลลูกค้าไม่สำเร็จ');
      },
    });
  }

  protected deleteCustomer(customer: Customer): void {
    if (
      !window.confirm(
        `ต้องการลบ ${customer.first_name} ${customer.last_name} ใช่หรือไม่? ออร์เดอร์ของลูกค้ารายนี้จะถูกลบด้วย`,
      )
    ) {
      return;
    }
    this.api.deleteCustomer(customer.customer_id).subscribe({
      next: () => {
        this.apiConnected.set(true);
        this.customers.update((items) =>
          items.filter((item) => item.customer_id !== customer.customer_id),
        );
        this.orders.update((items) =>
          items.filter((item) => item.customer_id !== customer.customer_id),
        );
        this.notice.set('ลบลูกค้าแล้ว');
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'ลบลูกค้าไม่สำเร็จ'),
    });
  }

  protected openNewOrder(): void {
    this.error.set('');
    this.editingOrderId.set(null);
    this.orderForm.set({
      customer_id: this.customers()[0]?.customer_id ?? 0,
      box_count: 1,
    });
    this.orderModalOpen.set(true);
  }

  protected editOrder(order: Order): void {
    this.error.set('');
    this.editingOrderId.set(order.order_id);
    this.orderForm.set({
      customer_id: order.customer_id,
      box_count: order.box_count,
    });
    this.orderModalOpen.set(true);
  }

  protected saveOrder(): void {
    const form = this.orderForm();
    if (!form.customer_id || !Number.isInteger(Number(form.box_count))) {
      this.error.set('กรุณาเลือกลูกค้าและจำนวนกล่อง');
      return;
    }
    const orderId = this.editingOrderId();
    this.saving.set(true);
    this.error.set('');
    const request = orderId
      ? this.api.updateOrder(orderId, Number(form.box_count))
      : this.api.createOrder({
          customer_id: Number(form.customer_id),
          box_count: Number(form.box_count),
        });

    request.subscribe({
      next: (order) => {
        this.apiConnected.set(true);
        this.orders.update((items) =>
          orderId
            ? items.map((item) => (item.order_id === order.order_id ? order : item))
            : [order, ...items],
        );
        this.orderModalOpen.set(false);
        this.saving.set(false);
        this.notice.set(orderId ? 'อัปเดตออร์เดอร์แล้ว' : 'สร้างออร์เดอร์แล้ว');
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.showError(error, 'บันทึกออร์เดอร์ไม่สำเร็จ');
      },
    });
  }

  protected deleteOrder(order: Order): void {
    if (!window.confirm(`ต้องการลบออร์เดอร์ #${order.order_id} ใช่หรือไม่?`)) {
      return;
    }
    this.api.deleteOrder(order.order_id).subscribe({
      next: () => {
        this.apiConnected.set(true);
        this.orders.update((items) => items.filter((item) => item.order_id !== order.order_id));
        this.notice.set('ลบออร์เดอร์แล้ว');
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'ลบออร์เดอร์ไม่สำเร็จ'),
    });
  }

  protected simulateOrders(): void {
    if (!this.customers().length) {
      this.error.set('เพิ่มลูกค้าก่อนจึงจะจำลองออร์เดอร์ได้');
      return;
    }
    this.saving.set(true);
    this.api.simulateOrders(20).subscribe({
      next: (result) => {
        this.apiConnected.set(true);
        this.orders.update((items) => [...result.orders, ...items]);
        this.saving.set(false);
        this.notice.set(`สร้างออร์เดอร์จำลอง ${result.count} รายการแล้ว`);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.showError(error, 'จำลองออร์เดอร์ไม่สำเร็จ');
      },
    });
  }

  protected clearOrders(): void {
    if (!this.orders().length || !window.confirm('ต้องการลบออร์เดอร์ทั้งหมดในระบบใช่หรือไม่?')) {
      return;
    }
    this.api.clearOrders().subscribe({
      next: () => {
        this.apiConnected.set(true);
        this.orders.set([]);
        this.notice.set('ล้างออร์เดอร์ทั้งหมดแล้ว');
      },
      error: (error: HttpErrorResponse) => this.showError(error, 'ล้างออร์เดอร์ไม่สำเร็จ'),
    });
  }

  protected customerName(order: Order): string {
    return `${order.first_name} ${order.last_name}`;
  }

  protected formatDate(date: string): string {
    return new Intl.DateTimeFormat('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  }

  protected formatTime(date: string): string {
    return new Intl.DateTimeFormat('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }

  protected updateCustomerForm(
    key: 'first_name' | 'last_name' | 'phone' | 'lat' | 'lng' | 'address_note',
    value: string | number,
  ): void {
    this.customerForm.update((form) => ({ ...form, [key]: value }));
  }

  protected updateOrderForm(key: 'customer_id' | 'box_count', value: number): void {
    this.orderForm.update((form) => ({ ...form, [key]: value }));
  }

  private emptyCustomerForm() {
    return {
      first_name: '',
      last_name: '',
      phone: '',
      lat: '' as string | number,
      lng: '' as string | number,
      address_note: '',
    };
  }

  private showError(error: HttpErrorResponse, fallback: string): void {
    this.apiConnected.set(false);
    this.error.set(
      error.error?.error ??
        (error.status === 0 || error.status === 502 || error.status === 503
          ? 'เชื่อมต่อ API ไม่ได้ โปรดตรวจสอบว่าเซิร์ฟเวอร์กำลังทำงาน'
          : fallback),
    );
  }
}
